/* */ 
'use strict';
var utils = require('../utils');
function patchSetClearFunction(obj, fnNames) {
  fnNames.map(function(name) {
    return name[0].toUpperCase() + name.substr(1);
  }).forEach(function(name) {
    var setName = 'set' + name;
    var delegate = obj[setName];
    if (delegate) {
      var clearName = 'clear' + name;
      var ids = {};
      var bindArgs = setName === 'setInterval' ? utils.bindArguments : utils.bindArgumentsOnce;
      global.zone[setName] = function(fn) {
        var id,
            fnRef = fn;
        arguments[0] = function() {
          delete ids[id];
          return fnRef.apply(this, arguments);
        };
        var args = bindArgs(arguments);
        id = delegate.apply(obj, args);
        ids[id] = true;
        return id;
      };
      obj[setName] = function() {
        return global.zone[setName].apply(this, arguments);
      };
      var clearDelegate = obj[clearName];
      global.zone[clearName] = function(id) {
        if (ids[id]) {
          delete ids[id];
          global.zone.dequeueTask();
        }
        return clearDelegate.apply(this, arguments);
      };
      obj[clearName] = function() {
        return global.zone[clearName].apply(this, arguments);
      };
    }
  });
}
;
function patchRequestAnimationFrame(obj, fnNames) {
  fnNames.forEach(function(name) {
    var delegate = obj[name];
    if (delegate) {
      global.zone[name] = function(fn) {
        var callZone = global.zone.isRootZone() ? global.zone.fork() : global.zone;
        if (fn) {
          arguments[0] = function() {
            return callZone.run(fn, this, arguments);
          };
        }
        return delegate.apply(obj, arguments);
      };
      obj[name] = function() {
        return global.zone[name].apply(this, arguments);
      };
    }
  });
}
;
function patchSetFunction(obj, fnNames) {
  fnNames.forEach(function(name) {
    var delegate = obj[name];
    if (delegate) {
      global.zone[name] = function(fn) {
        arguments[0] = function() {
          return fn.apply(this, arguments);
        };
        var args = utils.bindArgumentsOnce(arguments);
        return delegate.apply(obj, args);
      };
      obj[name] = function() {
        return zone[name].apply(this, arguments);
      };
    }
  });
}
;
function patchFunction(obj, fnNames) {
  fnNames.forEach(function(name) {
    var delegate = obj[name];
    global.zone[name] = function() {
      return delegate.apply(obj, arguments);
    };
    obj[name] = function() {
      return global.zone[name].apply(this, arguments);
    };
  });
}
;
module.exports = {
  patchSetClearFunction: patchSetClearFunction,
  patchSetFunction: patchSetFunction,
  patchRequestAnimationFrame: patchRequestAnimationFrame,
  patchFunction: patchFunction
};
