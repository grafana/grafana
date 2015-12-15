/* */ 
'use strict';
var global = require('./$.global'),
    $export = require('./$.export'),
    redefine = require('./$.redefine'),
    redefineAll = require('./$.redefine-all'),
    forOf = require('./$.for-of'),
    strictNew = require('./$.strict-new'),
    isObject = require('./$.is-object'),
    fails = require('./$.fails'),
    $iterDetect = require('./$.iter-detect'),
    setToStringTag = require('./$.set-to-string-tag');
module.exports = function(NAME, wrapper, methods, common, IS_MAP, IS_WEAK) {
  var Base = global[NAME],
      C = Base,
      ADDER = IS_MAP ? 'set' : 'add',
      proto = C && C.prototype,
      O = {};
  var fixMethod = function(KEY) {
    var fn = proto[KEY];
    redefine(proto, KEY, KEY == 'delete' ? function(a) {
      return IS_WEAK && !isObject(a) ? false : fn.call(this, a === 0 ? 0 : a);
    } : KEY == 'has' ? function has(a) {
      return IS_WEAK && !isObject(a) ? false : fn.call(this, a === 0 ? 0 : a);
    } : KEY == 'get' ? function get(a) {
      return IS_WEAK && !isObject(a) ? undefined : fn.call(this, a === 0 ? 0 : a);
    } : KEY == 'add' ? function add(a) {
      fn.call(this, a === 0 ? 0 : a);
      return this;
    } : function set(a, b) {
      fn.call(this, a === 0 ? 0 : a, b);
      return this;
    });
  };
  if (typeof C != 'function' || !(IS_WEAK || proto.forEach && !fails(function() {
    new C().entries().next();
  }))) {
    C = common.getConstructor(wrapper, NAME, IS_MAP, ADDER);
    redefineAll(C.prototype, methods);
  } else {
    var instance = new C,
        HASNT_CHAINING = instance[ADDER](IS_WEAK ? {} : -0, 1) != instance,
        THROWS_ON_PRIMITIVES = fails(function() {
          instance.has(1);
        }),
        ACCEPT_ITERABLES = $iterDetect(function(iter) {
          new C(iter);
        }),
        BUGGY_ZERO;
    if (!ACCEPT_ITERABLES) {
      C = wrapper(function(target, iterable) {
        strictNew(target, C, NAME);
        var that = new Base;
        if (iterable != undefined)
          forOf(iterable, IS_MAP, that[ADDER], that);
        return that;
      });
      C.prototype = proto;
      proto.constructor = C;
    }
    IS_WEAK || instance.forEach(function(val, key) {
      BUGGY_ZERO = 1 / key === -Infinity;
    });
    if (THROWS_ON_PRIMITIVES || BUGGY_ZERO) {
      fixMethod('delete');
      fixMethod('has');
      IS_MAP && fixMethod('get');
    }
    if (BUGGY_ZERO || HASNT_CHAINING)
      fixMethod(ADDER);
    if (IS_WEAK && proto.clear)
      delete proto.clear;
  }
  setToStringTag(C, NAME);
  O[NAME] = C;
  $export($export.G + $export.W + $export.F * (C != Base), O);
  if (!IS_WEAK)
    common.setStrong(C, NAME, IS_MAP);
  return C;
};
