/* */ 
'use strict';
var keys = require('./keys');
function Zone(parentZone, data) {
  var zone = (arguments.length) ? Object.create(parentZone) : this;
  zone.parent = parentZone || null;
  Object.keys(data || {}).forEach(function(property) {
    var _property = property.substr(1);
    if (property[0] === '$') {
      zone[_property] = data[property](parentZone[_property] || function() {});
    } else if (property[0] === '+') {
      if (parentZone[_property]) {
        zone[_property] = function() {
          var result = parentZone[_property].apply(this, arguments);
          data[property].apply(this, arguments);
          return result;
        };
      } else {
        zone[_property] = data[property];
      }
    } else if (property[0] === '-') {
      if (parentZone[_property]) {
        zone[_property] = function() {
          data[property].apply(this, arguments);
          return parentZone[_property].apply(this, arguments);
        };
      } else {
        zone[_property] = data[property];
      }
    } else {
      zone[property] = (typeof data[property] === 'object') ? JSON.parse(JSON.stringify(data[property])) : data[property];
    }
  });
  zone.$id = Zone.nextId++;
  return zone;
}
Zone.prototype = {
  constructor: Zone,
  fork: function(locals) {
    this.onZoneCreated();
    return new Zone(this, locals);
  },
  bind: function(fn, skipEnqueue) {
    if (typeof fn !== 'function') {
      throw new Error('Expecting function got: ' + fn);
    }
    skipEnqueue || this.enqueueTask(fn);
    var zone = this.isRootZone() ? this : this.fork();
    return function zoneBoundFn() {
      return zone.run(fn, this, arguments);
    };
  },
  bindOnce: function(fn) {
    var boundZone = this;
    return this.bind(function() {
      var result = fn.apply(this, arguments);
      boundZone.dequeueTask(fn);
      return result;
    });
  },
  isRootZone: function() {
    return this.parent === null;
  },
  run: function run(fn, applyTo, applyWith) {
    applyWith = applyWith || [];
    var oldZone = global.zone;
    global.zone = this;
    try {
      this.beforeTask();
      return fn.apply(applyTo, applyWith);
    } catch (e) {
      if (this.onError) {
        this.onError(e);
      } else {
        throw e;
      }
    } finally {
      this.afterTask();
      global.zone = oldZone;
    }
  },
  onError: null,
  beforeTask: function() {},
  onZoneCreated: function() {},
  afterTask: function() {},
  enqueueTask: function() {},
  dequeueTask: function() {},
  addEventListener: function() {
    return this[keys.common.addEventListener].apply(this, arguments);
  },
  removeEventListener: function() {
    return this[keys.common.removeEventListener].apply(this, arguments);
  }
};
Zone.nextId = 1;
Zone.bindPromiseFn = require('./patch/promise').bindPromiseFn;
module.exports = {Zone: Zone};
