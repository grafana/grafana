/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var math_1 = require('../facade/math');
var util_1 = require('../platform/dom/util');
var collection_1 = require('../facade/collection');
var dom_adapter_1 = require('../platform/dom/dom_adapter');
var Animation = (function() {
  function Animation(element, data, browserDetails) {
    var _this = this;
    this.element = element;
    this.data = data;
    this.browserDetails = browserDetails;
    this.callbacks = [];
    this.eventClearFunctions = [];
    this.completed = false;
    this._stringPrefix = '';
    this.startTime = lang_1.DateWrapper.toMillis(lang_1.DateWrapper.now());
    this._stringPrefix = dom_adapter_1.DOM.getAnimationPrefix();
    this.setup();
    this.wait(function(timestamp) {
      return _this.start();
    });
  }
  Object.defineProperty(Animation.prototype, "totalTime", {
    get: function() {
      var delay = this.computedDelay != null ? this.computedDelay : 0;
      var duration = this.computedDuration != null ? this.computedDuration : 0;
      return delay + duration;
    },
    enumerable: true,
    configurable: true
  });
  Animation.prototype.wait = function(callback) {
    this.browserDetails.raf(callback, 2);
  };
  Animation.prototype.setup = function() {
    if (this.data.fromStyles != null)
      this.applyStyles(this.data.fromStyles);
    if (this.data.duration != null)
      this.applyStyles({'transitionDuration': this.data.duration.toString() + 'ms'});
    if (this.data.delay != null)
      this.applyStyles({'transitionDelay': this.data.delay.toString() + 'ms'});
  };
  Animation.prototype.start = function() {
    this.addClasses(this.data.classesToAdd);
    this.addClasses(this.data.animationClasses);
    this.removeClasses(this.data.classesToRemove);
    if (this.data.toStyles != null)
      this.applyStyles(this.data.toStyles);
    var computedStyles = dom_adapter_1.DOM.getComputedStyle(this.element);
    this.computedDelay = math_1.Math.max(this.parseDurationString(computedStyles.getPropertyValue(this._stringPrefix + 'transition-delay')), this.parseDurationString(this.element.style.getPropertyValue(this._stringPrefix + 'transition-delay')));
    this.computedDuration = math_1.Math.max(this.parseDurationString(computedStyles.getPropertyValue(this._stringPrefix + 'transition-duration')), this.parseDurationString(this.element.style.getPropertyValue(this._stringPrefix + 'transition-duration')));
    this.addEvents();
  };
  Animation.prototype.applyStyles = function(styles) {
    var _this = this;
    collection_1.StringMapWrapper.forEach(styles, function(value, key) {
      var dashCaseKey = util_1.camelCaseToDashCase(key);
      if (lang_1.isPresent(dom_adapter_1.DOM.getStyle(_this.element, dashCaseKey))) {
        dom_adapter_1.DOM.setStyle(_this.element, dashCaseKey, value.toString());
      } else {
        dom_adapter_1.DOM.setStyle(_this.element, _this._stringPrefix + dashCaseKey, value.toString());
      }
    });
  };
  Animation.prototype.addClasses = function(classes) {
    for (var i = 0,
        len = classes.length; i < len; i++)
      dom_adapter_1.DOM.addClass(this.element, classes[i]);
  };
  Animation.prototype.removeClasses = function(classes) {
    for (var i = 0,
        len = classes.length; i < len; i++)
      dom_adapter_1.DOM.removeClass(this.element, classes[i]);
  };
  Animation.prototype.addEvents = function() {
    var _this = this;
    if (this.totalTime > 0) {
      this.eventClearFunctions.push(dom_adapter_1.DOM.onAndCancel(this.element, dom_adapter_1.DOM.getTransitionEnd(), function(event) {
        return _this.handleAnimationEvent(event);
      }));
    } else {
      this.handleAnimationCompleted();
    }
  };
  Animation.prototype.handleAnimationEvent = function(event) {
    var elapsedTime = math_1.Math.round(event.elapsedTime * 1000);
    if (!this.browserDetails.elapsedTimeIncludesDelay)
      elapsedTime += this.computedDelay;
    event.stopPropagation();
    if (elapsedTime >= this.totalTime)
      this.handleAnimationCompleted();
  };
  Animation.prototype.handleAnimationCompleted = function() {
    this.removeClasses(this.data.animationClasses);
    this.callbacks.forEach(function(callback) {
      return callback();
    });
    this.callbacks = [];
    this.eventClearFunctions.forEach(function(fn) {
      return fn();
    });
    this.eventClearFunctions = [];
    this.completed = true;
  };
  Animation.prototype.onComplete = function(callback) {
    if (this.completed) {
      callback();
    } else {
      this.callbacks.push(callback);
    }
    return this;
  };
  Animation.prototype.parseDurationString = function(duration) {
    var maxValue = 0;
    if (duration == null || duration.length < 2) {
      return maxValue;
    } else if (duration.substring(duration.length - 2) == 'ms') {
      var value = lang_1.NumberWrapper.parseInt(this.stripLetters(duration), 10);
      if (value > maxValue)
        maxValue = value;
    } else if (duration.substring(duration.length - 1) == 's') {
      var ms = lang_1.NumberWrapper.parseFloat(this.stripLetters(duration)) * 1000;
      var value = math_1.Math.floor(ms);
      if (value > maxValue)
        maxValue = value;
    }
    return maxValue;
  };
  Animation.prototype.stripLetters = function(str) {
    return lang_1.StringWrapper.replaceAll(str, lang_1.RegExpWrapper.create('[^0-9]+$', ''), '');
  };
  return Animation;
})();
exports.Animation = Animation;
