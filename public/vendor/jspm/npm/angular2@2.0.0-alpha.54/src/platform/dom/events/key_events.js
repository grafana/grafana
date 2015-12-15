/* */ 
(function(process) {
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
  var lang_1 = require('../../../facade/lang');
  var collection_1 = require('../../../facade/collection');
  var event_manager_1 = require('./event_manager');
  var di_1 = require('../../../core/di');
  var modifierKeys = ['alt', 'control', 'meta', 'shift'];
  var modifierKeyGetters = {
    'alt': function(event) {
      return event.altKey;
    },
    'control': function(event) {
      return event.ctrlKey;
    },
    'meta': function(event) {
      return event.metaKey;
    },
    'shift': function(event) {
      return event.shiftKey;
    }
  };
  var KeyEventsPlugin = (function(_super) {
    __extends(KeyEventsPlugin, _super);
    function KeyEventsPlugin() {
      _super.call(this);
    }
    KeyEventsPlugin.prototype.supports = function(eventName) {
      return lang_1.isPresent(KeyEventsPlugin.parseEventName(eventName));
    };
    KeyEventsPlugin.prototype.addEventListener = function(element, eventName, handler) {
      var parsedEvent = KeyEventsPlugin.parseEventName(eventName);
      var outsideHandler = KeyEventsPlugin.eventCallback(element, collection_1.StringMapWrapper.get(parsedEvent, 'fullKey'), handler, this.manager.getZone());
      this.manager.getZone().runOutsideAngular(function() {
        dom_adapter_1.DOM.on(element, collection_1.StringMapWrapper.get(parsedEvent, 'domEventName'), outsideHandler);
      });
    };
    KeyEventsPlugin.parseEventName = function(eventName) {
      var parts = eventName.toLowerCase().split('.');
      var domEventName = parts.shift();
      if ((parts.length === 0) || !(lang_1.StringWrapper.equals(domEventName, 'keydown') || lang_1.StringWrapper.equals(domEventName, 'keyup'))) {
        return null;
      }
      var key = KeyEventsPlugin._normalizeKey(parts.pop());
      var fullKey = '';
      modifierKeys.forEach(function(modifierName) {
        if (collection_1.ListWrapper.contains(parts, modifierName)) {
          collection_1.ListWrapper.remove(parts, modifierName);
          fullKey += modifierName + '.';
        }
      });
      fullKey += key;
      if (parts.length != 0 || key.length === 0) {
        return null;
      }
      var result = collection_1.StringMapWrapper.create();
      collection_1.StringMapWrapper.set(result, 'domEventName', domEventName);
      collection_1.StringMapWrapper.set(result, 'fullKey', fullKey);
      return result;
    };
    KeyEventsPlugin.getEventFullKey = function(event) {
      var fullKey = '';
      var key = dom_adapter_1.DOM.getEventKey(event);
      key = key.toLowerCase();
      if (lang_1.StringWrapper.equals(key, ' ')) {
        key = 'space';
      } else if (lang_1.StringWrapper.equals(key, '.')) {
        key = 'dot';
      }
      modifierKeys.forEach(function(modifierName) {
        if (modifierName != key) {
          var modifierGetter = collection_1.StringMapWrapper.get(modifierKeyGetters, modifierName);
          if (modifierGetter(event)) {
            fullKey += modifierName + '.';
          }
        }
      });
      fullKey += key;
      return fullKey;
    };
    KeyEventsPlugin.eventCallback = function(element, fullKey, handler, zone) {
      return function(event) {
        if (lang_1.StringWrapper.equals(KeyEventsPlugin.getEventFullKey(event), fullKey)) {
          zone.run(function() {
            return handler(event);
          });
        }
      };
    };
    KeyEventsPlugin._normalizeKey = function(keyName) {
      switch (keyName) {
        case 'esc':
          return 'escape';
        default:
          return keyName;
      }
    };
    KeyEventsPlugin = __decorate([di_1.Injectable(), __metadata('design:paramtypes', [])], KeyEventsPlugin);
    return KeyEventsPlugin;
  })(event_manager_1.EventManagerPlugin);
  exports.KeyEventsPlugin = KeyEventsPlugin;
})(require('process'));
