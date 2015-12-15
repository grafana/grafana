/* */ 
'use strict';
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
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
var hammer_common_1 = require('./hammer_common');
var lang_1 = require('../../../facade/lang');
var exceptions_1 = require('../../../facade/exceptions');
var di_1 = require('../../../core/di');
var HammerGesturesPlugin = (function(_super) {
  __extends(HammerGesturesPlugin, _super);
  function HammerGesturesPlugin() {
    _super.apply(this, arguments);
  }
  HammerGesturesPlugin.prototype.supports = function(eventName) {
    if (!_super.prototype.supports.call(this, eventName))
      return false;
    if (!lang_1.isPresent(window['Hammer'])) {
      throw new exceptions_1.BaseException("Hammer.js is not loaded, can not bind " + eventName + " event");
    }
    return true;
  };
  HammerGesturesPlugin.prototype.addEventListener = function(element, eventName, handler) {
    var zone = this.manager.getZone();
    eventName = eventName.toLowerCase();
    zone.runOutsideAngular(function() {
      var mc = new Hammer(element);
      mc.get('pinch').set({enable: true});
      mc.get('rotate').set({enable: true});
      mc.on(eventName, function(eventObj) {
        zone.run(function() {
          handler(eventObj);
        });
      });
    });
  };
  HammerGesturesPlugin = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], HammerGesturesPlugin);
  return HammerGesturesPlugin;
})(hammer_common_1.HammerGesturesPluginCommon);
exports.HammerGesturesPlugin = HammerGesturesPlugin;
