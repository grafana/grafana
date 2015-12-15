/* */ 
'use strict';
var __decorate = (this && this.__decorate) || function(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
};
var di_1 = require('../core/di');
var css_animation_builder_1 = require('./css_animation_builder');
var browser_details_1 = require('./browser_details');
var AnimationBuilder = (function() {
  function AnimationBuilder(browserDetails) {
    this.browserDetails = browserDetails;
  }
  AnimationBuilder.prototype.css = function() {
    return new css_animation_builder_1.CssAnimationBuilder(this.browserDetails);
  };
  AnimationBuilder = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [browser_details_1.BrowserDetails])], AnimationBuilder);
  return AnimationBuilder;
})();
exports.AnimationBuilder = AnimationBuilder;
