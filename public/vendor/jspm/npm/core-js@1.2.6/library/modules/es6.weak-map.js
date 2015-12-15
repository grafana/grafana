/* */ 
'use strict';
var $ = require('./$'),
    redefine = require('./$.redefine'),
    weak = require('./$.collection-weak'),
    isObject = require('./$.is-object'),
    has = require('./$.has'),
    frozenStore = weak.frozenStore,
    WEAK = weak.WEAK,
    isExtensible = Object.isExtensible || isObject,
    tmp = {};
var $WeakMap = require('./$.collection')('WeakMap', function(get) {
  return function WeakMap() {
    return get(this, arguments.length > 0 ? arguments[0] : undefined);
  };
}, {
  get: function get(key) {
    if (isObject(key)) {
      if (!isExtensible(key))
        return frozenStore(this).get(key);
      if (has(key, WEAK))
        return key[WEAK][this._i];
    }
  },
  set: function set(key, value) {
    return weak.def(this, key, value);
  }
}, weak, true, true);
if (new $WeakMap().set((Object.freeze || Object)(tmp), 7).get(tmp) != 7) {
  $.each.call(['delete', 'has', 'get', 'set'], function(key) {
    var proto = $WeakMap.prototype,
        method = proto[key];
    redefine(proto, key, function(a, b) {
      if (isObject(a) && !isExtensible(a)) {
        var result = frozenStore(this)[key](a, b);
        return key == 'set' ? this : result;
      }
      return method.call(this, a, b);
    });
  });
}
