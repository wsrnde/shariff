'use strict'

// require('babel-polyfill')

const $ = require('./dom')
const services = require('./services')
const url = require('url')

// Defaults may be overridden either by passing "options" to Shariff constructor
// or by setting data attributes.
const Defaults = {
  theme: 'color',

  // URL to backend that requests social counts. null means "disabled"
  backendUrl: null,

  // Link to the "about" page
  infoUrl: 'http://ct.de/-2467514',

  // localisation: "de" or "en"
  lang: 'de',

  // fallback language for not fully localized services
  langFallback: 'en',

  mailUrl: function() {
    var shareUrl = url.parse(this.getURL(), true)
    shareUrl.query.view = 'mail'
    delete shareUrl.search
    return url.format(shareUrl)
  },

  // if
  mailSubject: function() {
    return this.getMeta('DC.title') || this.getTitle()
  },

  mailBody: function() { return this.getURL() },

  // Media (e.g. image) URL to be shared
  mediaUrl: null,

  // horizontal/vertical
  orientation: 'horizontal',

  // a string to suffix current URL
  referrerTrack: null,

  // services to be enabled in the following order
  services: ['twitter', 'facebook', 'googleplus', 'info'],

  title: function() {
    return $('head title').text()
  },

  twitterVia: null,

  flattrUser: null,

  flattrCategory: null,

  // build URI from rel="canonical" or document.location
  url: function() {
    var url = global.document.location.href
    var canonical = $('link[rel=canonical]').attr('href') || this.getMeta('og:url') || ''

    if (canonical.length > 0) {
      if (canonical.indexOf('http') < 0) {
        canonical = global.document.location.protocol + '//' + global.document.location.host + canonical
      }
      url = canonical
    }

    return url
  }
}

class Shariff {
  constructor(element, options) {
    // the DOM element that will contain the buttons
    this.element = element

    // Ensure elemnt is empty
    $(element).empty()

    this.options = $.extend({}, Defaults, options, $(element).data())

    // filter available services to those that are enabled and initialize them
    this.services = Object.keys(services)
      .filter(service => this.isEnabledService(service))
      .map(serviceName => services[serviceName](this))

    this._addButtonList()

    if (this.options.backendUrl !== null) {
      this.getShares(this._updateCounts.bind(this))
    }
  }

  isEnabledService(serviceName) {
    return this.options.services.indexOf(serviceName) > 0
  }

  $socialshareElement() {
    return $(this.element)
  }

  getLocalized(data, key) {
    if (typeof data[key] === 'object') {
      if (typeof data[key][this.options.lang] === 'undefined') {
        return data[key][this.options.langFallback]
      } else {
        return data[key][this.options.lang]
      }
    } else if (typeof data[key] === 'string') {
      return data[key]
    }
    return undefined
  }

  // returns content of <meta name="" content=""> tags or '' if empty/non existant
  getMeta(name) {
    var metaContent = $(`meta[name="${name}"],[property="${name}"]`).attr('content')
    return metaContent || ''
  }

  getInfoUrl() {
    return this.options.infoUrl
  }

  getURL() {
    return this.getOption('url')
  }

  getOption(name) {
    var option = this.options[name]
    return (typeof option === 'function') ? option.call(this) : option
  }

  getTitle() {
    return this.getOption('title')
  }

  getReferrerTrack() {
    return this.options.referrerTrack || ''
  }

  // returns shareCounts of document
  getShares(callback) {
    var baseUrl = url.parse(this.options.backendUrl, true)
    baseUrl.query.url = this.getURL()
    delete baseUrl.search
    return $.getJSON(url.format(baseUrl), callback)
  }

  // add value of shares for each service
  _updateCounts(err, data) {
    if (err) return
    $.each(data, (key, value) => {
      if (!this.isEnabledService(key)) {
        return
      }
      if (value >= 1000) {
        value = Math.round(value / 1000) + 'k'
      }
      $(this.element).find('.' + key + ' a').append('&nbsp;<span class="share_count">' + value)
    })
  }

  // add html for button-container
  _addButtonList() {
    var $socialshareElement = this.$socialshareElement()

    var themeClass = 'theme-' + this.options.theme
    var orientationClass = 'orientation-' + this.options.orientation
    var serviceCountClass = 'col-' + this.options.services.length

    var $buttonList = $('<ul>')
      .addClass(themeClass)
      .addClass(orientationClass)
      .addClass(serviceCountClass)

    // add html for service-links
    this.services.forEach(service => {
      var $li = $('<li class="shariff-button">').addClass(service.name)
      var $shareText = '<span class="share_text">' + this.getLocalized(service, 'shareText')

      var $shareLink = $('<a>')
        .attr('href', service.shareUrl)
        .append($shareText)

      if (typeof service.faName !== 'undefined') {
        $shareLink.prepend('<span class="fa ' + service.faName + '">')
      }

      if (service.popup) {
        $shareLink.attr('data-rel', 'popup')
      } else if (service.blank) {
        $shareLink.attr('target', '_blank')
      }
      $shareLink.attr('title', this.getLocalized(service, 'title'))

      // add attributes for screen readers
      $shareLink.attr('role', 'button')
      $shareLink.attr('aria-label', this.getLocalized(service, 'title'))

      $li.append($shareLink)

      $buttonList.append($li)
    })

    // event delegation
    $buttonList.on('click', '[data-rel="popup"]', function(e) {
      e.preventDefault()

      var url = $(this).attr('href')

      // if a twitter widget is embedded on current site twitter's widget.js
      // will open a popup so we should not open a second one.
      if (url.match(/twitter\.com\/intent\/(\w+)/)) {
        var w = global.window
        if (w.__twttr && w.__twttr.widgets && w.__twttr.widgets.loaded) {
          return
        }
      }

      global.window.open(url, '_blank', 'width=600,height=460')
    })

    $socialshareElement.append($buttonList)
  }
}

module.exports = Shariff

// export Shariff class to global (for non-Node users)
global.Shariff = Shariff

$(function() {
  // initialize .shariff elements
  $('.shariff').each(function() {
    if (!this.hasOwnProperty('shariff')) {
      this.shariff = new Shariff(this)
    }
  })
})
