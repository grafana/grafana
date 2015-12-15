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
var dom_adapter_1 = require('../dom_adapter');
var core_1 = require('../../../../core');
var event_manager_1 = require('./event_manager');
var DomEventsPlugin = (function(_super) {
  __extends(DomEventsPlugin, _super);
  function DomEventsPlugin() {
    _super.apply(this, arguments);
  }
  DomEventsPlugin.prototype.supports = function(eventName) {
    return true;
  };
  DomEventsPlugin.prototype.addEventListener = function(element, eventName, handler) {
    var zone = this.manager.getZone();
    var outsideHandler = function(event) {
      return zone.run(function() {
        return handler(event);
      });
    };
    this.manager.getZone().runOutsideAngular(function() {
      dom_adapter_1.DOM.on(element, eventName, outsideHandler);
    });
  };
  DomEventsPlugin.prototype.addGlobalEventListener = function(target, eventName, handler) {
    var element = dom_adapter_1.DOM.getGlobalEventTarget(target);
    var zone = this.manager.getZone();
    var outsideHandler = function(event) {
      return zone.run(function() {
        return handler(event);
      });
    };
    return this.manager.getZone().runOutsideAngular(function() {
      return dom_adapter_1.DOM.onAndCancel(element, eventName, outsideHandler);
    });
  };
  DomEventsPlugin = __decorate([core_1.Injectable(), __metadata('design:paramtypes', [])], DomEventsPlugin);
  return DomEventsPlugin;
})(event_manager_1.EventManagerPlugin);
exports.DomEventsPlugin = DomEventsPlugin;
