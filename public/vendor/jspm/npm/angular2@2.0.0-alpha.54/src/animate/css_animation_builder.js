/* */ 
'use strict';
var css_animation_options_1 = require('./css_animation_options');
var animation_1 = require('./animation');
var CssAnimationBuilder = (function() {
  function CssAnimationBuilder(browserDetails) {
    this.browserDetails = browserDetails;
    this.data = new css_animation_options_1.CssAnimationOptions();
  }
  CssAnimationBuilder.prototype.addAnimationClass = function(className) {
    this.data.animationClasses.push(className);
    return this;
  };
  CssAnimationBuilder.prototype.addClass = function(className) {
    this.data.classesToAdd.push(className);
    return this;
  };
  CssAnimationBuilder.prototype.removeClass = function(className) {
    this.data.classesToRemove.push(className);
    return this;
  };
  CssAnimationBuilder.prototype.setDuration = function(duration) {
    this.data.duration = duration;
    return this;
  };
  CssAnimationBuilder.prototype.setDelay = function(delay) {
    this.data.delay = delay;
    return this;
  };
  CssAnimationBuilder.prototype.setStyles = function(from, to) {
    return this.setFromStyles(from).setToStyles(to);
  };
  CssAnimationBuilder.prototype.setFromStyles = function(from) {
    this.data.fromStyles = from;
    return this;
  };
  CssAnimationBuilder.prototype.setToStyles = function(to) {
    this.data.toStyles = to;
    return this;
  };
  CssAnimationBuilder.prototype.start = function(element) {
    return new animation_1.Animation(element, this.data, this.browserDetails);
  };
  return CssAnimationBuilder;
})();
exports.CssAnimationBuilder = CssAnimationBuilder;
