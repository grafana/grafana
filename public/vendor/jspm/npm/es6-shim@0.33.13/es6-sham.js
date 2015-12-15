/* */ 
"format cjs";
 /*!
  * https://github.com/paulmillr/es6-shim
  * @license es6-shim Copyright 2013-2015 by Paul Miller (http://paulmillr.com)
  *   and contributors,  MIT License
  * es6-sham: v0.33.13
  * see https://github.com/paulmillr/es6-shim/blob/0.33.13/LICENSE
  * Details and documentation:
  * https://github.com/paulmillr/es6-shim/
  */

// UMD (Universal Module Definition)
// see https://github.com/umdjs/umd/blob/master/returnExports.js
(function (root, factory) {
  /*global define, exports, module */
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like enviroments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.returnExports = factory();
  }
}(this, function () {
  'use strict';

  /*jshint evil: true */
  /* eslint-disable no-new-func */
  var getGlobal = new Function('return this;');
  /* eslint-enable no-new-func */
  /*jshint evil: false */

  var globals = getGlobal();
  var Object = globals.Object;

  // NOTE:  This versions needs object ownership
  //        beacuse every promoted object needs to be reassigned
  //        otherwise uncompatible browsers cannot work as expected
  //
  // NOTE:  This might need es5-shim or polyfills upfront
  //        because it's based on ES5 API.
  //        (probably just an IE <= 8 problem)
  //
  // NOTE:  nodejs is fine in version 0.8, 0.10, and future versions.
  (function () {
    if (Object.setPrototypeOf) { return; }

    /*jshint proto: true */
    // @author    Andrea Giammarchi - @WebReflection

    var getOwnPropertyNames = Object.getOwnPropertyNames;
    var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    var create = Object.create;
    var defineProperty = Object.defineProperty;
    var getPrototypeOf = Object.getPrototypeOf;
    var objProto = Object.prototype;

    var copyDescriptors = function (target, source) {
      // define into target descriptors from source
      getOwnPropertyNames(source).forEach(function (key) {
        defineProperty(
          target,
          key,
          getOwnPropertyDescriptor(source, key)
        );
      });
      return target;
    };
    // used as fallback when no promotion is possible
    var createAndCopy = function (origin, proto) {
      return copyDescriptors(create(proto), origin);
    };
    var set, setPrototypeOf;
    try {
      // this might fail for various reasons
      // ignore if Chrome cought it at runtime
      set = getOwnPropertyDescriptor(objProto, '__proto__').set;
      set.call({}, null);
      // setter not poisoned, it can promote
      // Firefox, Chrome
      setPrototypeOf = function (origin, proto) {
        set.call(origin, proto);
        return origin;
      };
    } catch (e) {
      // do one or more feature detections
      set = { __proto__: null };
      // if proto does not work, needs to fallback
      // some Opera, Rhino, ducktape
      if (set instanceof Object) {
        setPrototypeOf = createAndCopy;
      } else {
        // verify if null objects are buggy
        /* eslint-disable no-proto */
        set.__proto__ = objProto;
        /* eslint-enable no-proto */
        // if null objects are buggy
        // nodejs 0.8 to 0.10
        if (set instanceof Object) {
          setPrototypeOf = function (origin, proto) {
            // use such bug to promote
            /* eslint-disable no-proto */
            origin.__proto__ = proto;
            /* eslint-enable no-proto */
            return origin;
          };
        } else {
          // try to use proto or fallback
          // Safari, old Firefox, many others
          setPrototypeOf = function (origin, proto) {
            // if proto is not null
            if (getPrototypeOf(origin)) {
              // use __proto__ to promote
              /* eslint-disable no-proto */
              origin.__proto__ = proto;
              /* eslint-enable no-proto */
              return origin;
            } else {
              // otherwise unable to promote: fallback
              return createAndCopy(origin, proto);
            }
          };
        }
      }
    }
    Object.setPrototypeOf = setPrototypeOf;
  }());

}));
