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
var __param = (this && this.__param) || function(paramIndex, decorator) {
  return function(target, key) {
    decorator(target, key, paramIndex);
  };
};
var lang_1 = require('../../../facade/lang');
var exceptions_1 = require('../../../facade/exceptions');
var di_1 = require('../../../core/di');
var ng_zone_1 = require('../../../core/zone/ng_zone');
var collection_1 = require('../../../facade/collection');
exports.EVENT_MANAGER_PLUGINS = lang_1.CONST_EXPR(new di_1.OpaqueToken("EventManagerPlugins"));
var EventManager = (function() {
  function EventManager(plugins, _zone) {
    var _this = this;
    this._zone = _zone;
    plugins.forEach(function(p) {
      return p.manager = _this;
    });
    this._plugins = collection_1.ListWrapper.reversed(plugins);
  }
  EventManager.prototype.addEventListener = function(element, eventName, handler) {
    var plugin = this._findPluginFor(eventName);
    plugin.addEventListener(element, eventName, handler);
  };
  EventManager.prototype.addGlobalEventListener = function(target, eventName, handler) {
    var plugin = this._findPluginFor(eventName);
    return plugin.addGlobalEventListener(target, eventName, handler);
  };
  EventManager.prototype.getZone = function() {
    return this._zone;
  };
  EventManager.prototype._findPluginFor = function(eventName) {
    var plugins = this._plugins;
    for (var i = 0; i < plugins.length; i++) {
      var plugin = plugins[i];
      if (plugin.supports(eventName)) {
        return plugin;
      }
    }
    throw new exceptions_1.BaseException("No event manager plugin found for event " + eventName);
  };
  EventManager = __decorate([di_1.Injectable(), __param(0, di_1.Inject(exports.EVENT_MANAGER_PLUGINS)), __metadata('design:paramtypes', [Array, ng_zone_1.NgZone])], EventManager);
  return EventManager;
})();
exports.EventManager = EventManager;
var EventManagerPlugin = (function() {
  function EventManagerPlugin() {}
  EventManagerPlugin.prototype.supports = function(eventName) {
    return false;
  };
  EventManagerPlugin.prototype.addEventListener = function(element, eventName, handler) {
    throw "not implemented";
  };
  EventManagerPlugin.prototype.addGlobalEventListener = function(element, eventName, handler) {
    throw "not implemented";
  };
  return EventManagerPlugin;
})();
exports.EventManagerPlugin = EventManagerPlugin;
