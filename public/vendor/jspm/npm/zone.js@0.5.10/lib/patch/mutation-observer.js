/* */ 
'use strict';
var keys = require('../keys');
var originalInstanceKey = keys.create('originalInstance');
var creationZoneKey = keys.create('creationZone');
var isActiveKey = keys.create('isActive');
function patchClass(className) {
  var OriginalClass = global[className];
  if (!OriginalClass)
    return;
  global[className] = function(fn) {
    this[originalInstanceKey] = new OriginalClass(global.zone.bind(fn, true));
    this[creationZoneKey] = global.zone;
  };
  var instance = new OriginalClass(function() {});
  global[className].prototype.disconnect = function() {
    var result = this[originalInstanceKey].disconnect.apply(this[originalInstanceKey], arguments);
    if (this[isActiveKey]) {
      this[creationZoneKey].dequeueTask();
      this[isActiveKey] = false;
    }
    return result;
  };
  global[className].prototype.observe = function() {
    if (!this[isActiveKey]) {
      this[creationZoneKey].enqueueTask();
      this[isActiveKey] = true;
    }
    return this[originalInstanceKey].observe.apply(this[originalInstanceKey], arguments);
  };
  var prop;
  for (prop in instance) {
    (function(prop) {
      if (typeof global[className].prototype !== 'undefined') {
        return;
      }
      if (typeof instance[prop] === 'function') {
        global[className].prototype[prop] = function() {
          return this[originalInstanceKey][prop].apply(this[originalInstanceKey], arguments);
        };
      } else {
        Object.defineProperty(global[className].prototype, prop, {
          set: function(fn) {
            if (typeof fn === 'function') {
              this[originalInstanceKey][prop] = global.zone.bind(fn);
            } else {
              this[originalInstanceKey][prop] = fn;
            }
          },
          get: function() {
            return this[originalInstanceKey][prop];
          }
        });
      }
    }(prop));
  }
}
;
module.exports = {patchClass: patchClass};
