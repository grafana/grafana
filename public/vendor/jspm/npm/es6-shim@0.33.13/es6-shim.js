/* */ 
"format cjs";
(function(process) {
  (function(root, factory) {
    if (typeof define === 'function' && define.amd) {
      define(factory);
    } else if (typeof exports === 'object') {
      module.exports = factory();
    } else {
      root.returnExports = factory();
    }
  }(this, function() {
    'use strict';
    var _apply = Function.call.bind(Function.apply);
    var _call = Function.call.bind(Function.call);
    var isArray = Array.isArray;
    var not = function notThunker(func) {
      return function notThunk() {
        return !_apply(func, this, arguments);
      };
    };
    var throwsError = function(func) {
      try {
        func();
        return false;
      } catch (e) {
        return true;
      }
    };
    var valueOrFalseIfThrows = function valueOrFalseIfThrows(func) {
      try {
        return func();
      } catch (e) {
        return false;
      }
    };
    var isCallableWithoutNew = not(throwsError);
    var arePropertyDescriptorsSupported = function() {
      return !throwsError(function() {
        Object.defineProperty({}, 'x', {get: function() {}});
      });
    };
    var supportsDescriptors = !!Object.defineProperty && arePropertyDescriptorsSupported();
    var functionsHaveNames = (function foo() {}).name === 'foo';
    var _forEach = Function.call.bind(Array.prototype.forEach);
    var _reduce = Function.call.bind(Array.prototype.reduce);
    var _filter = Function.call.bind(Array.prototype.filter);
    var _some = Function.call.bind(Array.prototype.some);
    var defineProperty = function(object, name, value, force) {
      if (!force && name in object) {
        return;
      }
      if (supportsDescriptors) {
        Object.defineProperty(object, name, {
          configurable: true,
          enumerable: false,
          writable: true,
          value: value
        });
      } else {
        object[name] = value;
      }
    };
    var defineProperties = function(object, map) {
      _forEach(Object.keys(map), function(name) {
        var method = map[name];
        defineProperty(object, name, method, false);
      });
    };
    var create = Object.create || function(prototype, properties) {
      var Prototype = function Prototype() {};
      Prototype.prototype = prototype;
      var object = new Prototype();
      if (typeof properties !== 'undefined') {
        Object.keys(properties).forEach(function(key) {
          Value.defineByDescriptor(object, key, properties[key]);
        });
      }
      return object;
    };
    var supportsSubclassing = function(C, f) {
      if (!Object.setPrototypeOf) {
        return false;
      }
      return valueOrFalseIfThrows(function() {
        var Sub = function Subclass(arg) {
          var o = new C(arg);
          Object.setPrototypeOf(o, Subclass.prototype);
          return o;
        };
        Object.setPrototypeOf(Sub, C);
        Sub.prototype = create(C.prototype, {constructor: {value: Sub}});
        return f(Sub);
      });
    };
    var getGlobal = function() {
      if (typeof self !== 'undefined') {
        return self;
      }
      if (typeof window !== 'undefined') {
        return window;
      }
      if (typeof global !== 'undefined') {
        return global;
      }
      throw new Error('unable to locate global object');
    };
    var globals = getGlobal();
    var globalIsFinite = globals.isFinite;
    var _indexOf = Function.call.bind(String.prototype.indexOf);
    var _toString = Function.call.bind(Object.prototype.toString);
    var _concat = Function.call.bind(Array.prototype.concat);
    var _strSlice = Function.call.bind(String.prototype.slice);
    var _push = Function.call.bind(Array.prototype.push);
    var _pushApply = Function.apply.bind(Array.prototype.push);
    var _shift = Function.call.bind(Array.prototype.shift);
    var _max = Math.max;
    var _min = Math.min;
    var _floor = Math.floor;
    var _abs = Math.abs;
    var _log = Math.log;
    var _sqrt = Math.sqrt;
    var _hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);
    var ArrayIterator;
    var noop = function() {};
    var Symbol = globals.Symbol || {};
    var symbolSpecies = Symbol.species || '@@species';
    var numberIsNaN = Number.isNaN || function isNaN(value) {
      return value !== value;
    };
    var numberIsFinite = Number.isFinite || function isFinite(value) {
      return typeof value === 'number' && globalIsFinite(value);
    };
    var isStandardArguments = function isArguments(value) {
      return _toString(value) === '[object Arguments]';
    };
    var isLegacyArguments = function isArguments(value) {
      return value !== null && typeof value === 'object' && typeof value.length === 'number' && value.length >= 0 && _toString(value) !== '[object Array]' && _toString(value.callee) === '[object Function]';
    };
    var isArguments = isStandardArguments(arguments) ? isStandardArguments : isLegacyArguments;
    var Type = {
      primitive: function(x) {
        return x === null || (typeof x !== 'function' && typeof x !== 'object');
      },
      object: function(x) {
        return x !== null && typeof x === 'object';
      },
      string: function(x) {
        return _toString(x) === '[object String]';
      },
      regex: function(x) {
        return _toString(x) === '[object RegExp]';
      },
      symbol: function(x) {
        return typeof globals.Symbol === 'function' && typeof x === 'symbol';
      }
    };
    var $iterator$ = Type.symbol(Symbol.iterator) ? Symbol.iterator : '_es6-shim iterator_';
    if (globals.Set && typeof new globals.Set()['@@iterator'] === 'function') {
      $iterator$ = '@@iterator';
    }
    if (!globals.Reflect) {
      defineProperty(globals, 'Reflect', {});
    }
    var Reflect = globals.Reflect;
    var ES = {
      Call: function Call(F, V) {
        var args = arguments.length > 2 ? arguments[2] : [];
        if (!ES.IsCallable(F)) {
          throw new TypeError(F + ' is not a function');
        }
        return _apply(F, V, args);
      },
      RequireObjectCoercible: function(x, optMessage) {
        if (x == null) {
          throw new TypeError(optMessage || 'Cannot call method on ' + x);
        }
      },
      TypeIsObject: function(x) {
        return x != null && Object(x) === x;
      },
      ToObject: function(o, optMessage) {
        ES.RequireObjectCoercible(o, optMessage);
        return Object(o);
      },
      IsCallable: function(x) {
        return typeof x === 'function' && _toString(x) === '[object Function]';
      },
      IsConstructor: function(x) {
        return ES.IsCallable(x);
      },
      ToInt32: function(x) {
        return ES.ToNumber(x) >> 0;
      },
      ToUint32: function(x) {
        return ES.ToNumber(x) >>> 0;
      },
      ToNumber: function(value) {
        if (_toString(value) === '[object Symbol]') {
          throw new TypeError('Cannot convert a Symbol value to a number');
        }
        return +value;
      },
      ToInteger: function(value) {
        var number = ES.ToNumber(value);
        if (numberIsNaN(number)) {
          return 0;
        }
        if (number === 0 || !numberIsFinite(number)) {
          return number;
        }
        return (number > 0 ? 1 : -1) * _floor(_abs(number));
      },
      ToLength: function(value) {
        var len = ES.ToInteger(value);
        if (len <= 0) {
          return 0;
        }
        if (len > Number.MAX_SAFE_INTEGER) {
          return Number.MAX_SAFE_INTEGER;
        }
        return len;
      },
      SameValue: function(a, b) {
        if (a === b) {
          if (a === 0) {
            return 1 / a === 1 / b;
          }
          return true;
        }
        return numberIsNaN(a) && numberIsNaN(b);
      },
      SameValueZero: function(a, b) {
        return (a === b) || (numberIsNaN(a) && numberIsNaN(b));
      },
      IsIterable: function(o) {
        return ES.TypeIsObject(o) && (typeof o[$iterator$] !== 'undefined' || isArguments(o));
      },
      GetIterator: function(o) {
        if (isArguments(o)) {
          return new ArrayIterator(o, 'value');
        }
        var itFn = ES.GetMethod(o, $iterator$);
        if (!ES.IsCallable(itFn)) {
          throw new TypeError('value is not an iterable');
        }
        var it = _call(itFn, o);
        if (!ES.TypeIsObject(it)) {
          throw new TypeError('bad iterator');
        }
        return it;
      },
      GetMethod: function(o, p) {
        var func = ES.ToObject(o)[p];
        if (func === void 0 || func === null) {
          return void 0;
        }
        if (!ES.IsCallable(func)) {
          throw new TypeError('Method not callable: ' + p);
        }
        return func;
      },
      IteratorComplete: function(iterResult) {
        return !!(iterResult.done);
      },
      IteratorClose: function(iterator, completionIsThrow) {
        var returnMethod = ES.GetMethod(iterator, 'return');
        if (returnMethod === void 0) {
          return;
        }
        var innerResult,
            innerException;
        try {
          innerResult = _call(returnMethod, iterator);
        } catch (e) {
          innerException = e;
        }
        if (completionIsThrow) {
          return;
        }
        if (innerException) {
          throw innerException;
        }
        if (!ES.TypeIsObject(innerResult)) {
          throw new TypeError("Iterator's return method returned a non-object.");
        }
      },
      IteratorNext: function(it) {
        var result = arguments.length > 1 ? it.next(arguments[1]) : it.next();
        if (!ES.TypeIsObject(result)) {
          throw new TypeError('bad iterator');
        }
        return result;
      },
      IteratorStep: function(it) {
        var result = ES.IteratorNext(it);
        var done = ES.IteratorComplete(result);
        return done ? false : result;
      },
      Construct: function(C, args, newTarget, isES6internal) {
        var target = typeof newTarget === 'undefined' ? C : newTarget;
        if (!isES6internal) {
          return Reflect.construct(C, args, target);
        }
        var proto = target.prototype;
        if (!ES.TypeIsObject(proto)) {
          proto = Object.prototype;
        }
        var obj = create(proto);
        var result = ES.Call(C, obj, args);
        return ES.TypeIsObject(result) ? result : obj;
      },
      SpeciesConstructor: function(O, defaultConstructor) {
        var C = O.constructor;
        if (C === void 0) {
          return defaultConstructor;
        }
        if (!ES.TypeIsObject(C)) {
          throw new TypeError('Bad constructor');
        }
        var S = C[symbolSpecies];
        if (S === void 0 || S === null) {
          return defaultConstructor;
        }
        if (!ES.IsConstructor(S)) {
          throw new TypeError('Bad @@species');
        }
        return S;
      },
      CreateHTML: function(string, tag, attribute, value) {
        var S = String(string);
        var p1 = '<' + tag;
        if (attribute !== '') {
          var V = String(value);
          var escapedV = V.replace(/"/g, '&quot;');
          p1 += ' ' + attribute + '="' + escapedV + '"';
        }
        var p2 = p1 + '>';
        var p3 = p2 + S;
        return p3 + '</' + tag + '>';
      }
    };
    var Value = {
      getter: function(object, name, getter) {
        if (!supportsDescriptors) {
          throw new TypeError('getters require true ES5 support');
        }
        Object.defineProperty(object, name, {
          configurable: true,
          enumerable: false,
          get: getter
        });
      },
      proxy: function(originalObject, key, targetObject) {
        if (!supportsDescriptors) {
          throw new TypeError('getters require true ES5 support');
        }
        var originalDescriptor = Object.getOwnPropertyDescriptor(originalObject, key);
        Object.defineProperty(targetObject, key, {
          configurable: originalDescriptor.configurable,
          enumerable: originalDescriptor.enumerable,
          get: function getKey() {
            return originalObject[key];
          },
          set: function setKey(value) {
            originalObject[key] = value;
          }
        });
      },
      redefine: function(object, property, newValue) {
        if (supportsDescriptors) {
          var descriptor = Object.getOwnPropertyDescriptor(object, property);
          descriptor.value = newValue;
          Object.defineProperty(object, property, descriptor);
        } else {
          object[property] = newValue;
        }
      },
      defineByDescriptor: function(object, property, descriptor) {
        if (supportsDescriptors) {
          Object.defineProperty(object, property, descriptor);
        } else if ('value' in descriptor) {
          object[property] = descriptor.value;
        }
      },
      preserveToString: function(target, source) {
        if (source && ES.IsCallable(source.toString)) {
          defineProperty(target, 'toString', source.toString.bind(source), true);
        }
      }
    };
    var wrapConstructor = function wrapConstructor(original, replacement, keysToSkip) {
      Value.preserveToString(replacement, original);
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(original, replacement);
      }
      if (supportsDescriptors) {
        _forEach(Object.getOwnPropertyNames(original), function(key) {
          if (key in noop || keysToSkip[key]) {
            return;
          }
          Value.proxy(original, key, replacement);
        });
      } else {
        _forEach(Object.keys(original), function(key) {
          if (key in noop || keysToSkip[key]) {
            return;
          }
          replacement[key] = original[key];
        });
      }
      replacement.prototype = original.prototype;
      Value.redefine(original.prototype, 'constructor', replacement);
    };
    var defaultSpeciesGetter = function() {
      return this;
    };
    var addDefaultSpecies = function(C) {
      if (supportsDescriptors && !_hasOwnProperty(C, symbolSpecies)) {
        Value.getter(C, symbolSpecies, defaultSpeciesGetter);
      }
    };
    var overrideNative = function overrideNative(object, property, replacement) {
      var original = object[property];
      defineProperty(object, property, replacement, true);
      Value.preserveToString(object[property], original);
    };
    var addIterator = function(prototype, impl) {
      var implementation = impl || function iterator() {
        return this;
      };
      defineProperty(prototype, $iterator$, implementation);
      if (!prototype[$iterator$] && Type.symbol($iterator$)) {
        prototype[$iterator$] = implementation;
      }
    };
    var createDataProperty = function createDataProperty(object, name, value) {
      if (supportsDescriptors) {
        Object.defineProperty(object, name, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: value
        });
      } else {
        object[name] = value;
      }
    };
    var createDataPropertyOrThrow = function createDataPropertyOrThrow(object, name, value) {
      createDataProperty(object, name, value);
      if (!ES.SameValue(object[name], value)) {
        throw new TypeError('property is nonconfigurable');
      }
    };
    var emulateES6construct = function(o, defaultNewTarget, defaultProto, slots) {
      if (!ES.TypeIsObject(o)) {
        throw new TypeError('Constructor requires `new`: ' + defaultNewTarget.name);
      }
      var proto = defaultNewTarget.prototype;
      if (!ES.TypeIsObject(proto)) {
        proto = defaultProto;
      }
      var obj = create(proto);
      for (var name in slots) {
        if (_hasOwnProperty(slots, name)) {
          var value = slots[name];
          defineProperty(obj, name, value, true);
        }
      }
      return obj;
    };
    if (String.fromCodePoint && String.fromCodePoint.length !== 1) {
      var originalFromCodePoint = String.fromCodePoint;
      overrideNative(String, 'fromCodePoint', function fromCodePoint(codePoints) {
        return _apply(originalFromCodePoint, this, arguments);
      });
    }
    var StringShims = {
      fromCodePoint: function fromCodePoint(codePoints) {
        var result = [];
        var next;
        for (var i = 0,
            length = arguments.length; i < length; i++) {
          next = Number(arguments[i]);
          if (!ES.SameValue(next, ES.ToInteger(next)) || next < 0 || next > 0x10FFFF) {
            throw new RangeError('Invalid code point ' + next);
          }
          if (next < 0x10000) {
            _push(result, String.fromCharCode(next));
          } else {
            next -= 0x10000;
            _push(result, String.fromCharCode((next >> 10) + 0xD800));
            _push(result, String.fromCharCode((next % 0x400) + 0xDC00));
          }
        }
        return result.join('');
      },
      raw: function raw(callSite) {
        var cooked = ES.ToObject(callSite, 'bad callSite');
        var rawString = ES.ToObject(cooked.raw, 'bad raw value');
        var len = rawString.length;
        var literalsegments = ES.ToLength(len);
        if (literalsegments <= 0) {
          return '';
        }
        var stringElements = [];
        var nextIndex = 0;
        var nextKey,
            next,
            nextSeg,
            nextSub;
        while (nextIndex < literalsegments) {
          nextKey = String(nextIndex);
          nextSeg = String(rawString[nextKey]);
          _push(stringElements, nextSeg);
          if (nextIndex + 1 >= literalsegments) {
            break;
          }
          next = nextIndex + 1 < arguments.length ? arguments[nextIndex + 1] : '';
          nextSub = String(next);
          _push(stringElements, nextSub);
          nextIndex += 1;
        }
        return stringElements.join('');
      }
    };
    if (String.raw && String.raw({raw: {
        0: 'x',
        1: 'y',
        length: 2
      }}) !== 'xy') {
      overrideNative(String, 'raw', StringShims.raw);
    }
    defineProperties(String, StringShims);
    var stringRepeat = function repeat(s, times) {
      if (times < 1) {
        return '';
      }
      if (times % 2) {
        return repeat(s, times - 1) + s;
      }
      var half = repeat(s, times / 2);
      return half + half;
    };
    var stringMaxLength = Infinity;
    var StringPrototypeShims = {
      repeat: function repeat(times) {
        ES.RequireObjectCoercible(this);
        var thisStr = String(this);
        var numTimes = ES.ToInteger(times);
        if (numTimes < 0 || numTimes >= stringMaxLength) {
          throw new RangeError('repeat count must be less than infinity and not overflow maximum string size');
        }
        return stringRepeat(thisStr, numTimes);
      },
      startsWith: function startsWith(searchString) {
        ES.RequireObjectCoercible(this);
        var thisStr = String(this);
        if (Type.regex(searchString)) {
          throw new TypeError('Cannot call method "startsWith" with a regex');
        }
        var searchStr = String(searchString);
        var startArg = arguments.length > 1 ? arguments[1] : void 0;
        var start = _max(ES.ToInteger(startArg), 0);
        return _strSlice(thisStr, start, start + searchStr.length) === searchStr;
      },
      endsWith: function endsWith(searchString) {
        ES.RequireObjectCoercible(this);
        var thisStr = String(this);
        if (Type.regex(searchString)) {
          throw new TypeError('Cannot call method "endsWith" with a regex');
        }
        var searchStr = String(searchString);
        var thisLen = thisStr.length;
        var posArg = arguments.length > 1 ? arguments[1] : void 0;
        var pos = typeof posArg === 'undefined' ? thisLen : ES.ToInteger(posArg);
        var end = _min(_max(pos, 0), thisLen);
        return _strSlice(thisStr, end - searchStr.length, end) === searchStr;
      },
      includes: function includes(searchString) {
        if (Type.regex(searchString)) {
          throw new TypeError('"includes" does not accept a RegExp');
        }
        var position;
        if (arguments.length > 1) {
          position = arguments[1];
        }
        return _indexOf(this, searchString, position) !== -1;
      },
      codePointAt: function codePointAt(pos) {
        ES.RequireObjectCoercible(this);
        var thisStr = String(this);
        var position = ES.ToInteger(pos);
        var length = thisStr.length;
        if (position >= 0 && position < length) {
          var first = thisStr.charCodeAt(position);
          var isEnd = (position + 1 === length);
          if (first < 0xD800 || first > 0xDBFF || isEnd) {
            return first;
          }
          var second = thisStr.charCodeAt(position + 1);
          if (second < 0xDC00 || second > 0xDFFF) {
            return first;
          }
          return ((first - 0xD800) * 1024) + (second - 0xDC00) + 0x10000;
        }
      }
    };
    if (String.prototype.includes && 'a'.includes('a', Infinity) !== false) {
      overrideNative(String.prototype, 'includes', StringPrototypeShims.includes);
    }
    if (String.prototype.startsWith && String.prototype.endsWith) {
      var startsWithRejectsRegex = throwsError(function() {
        '/a/'.startsWith(/a/);
      });
      var startsWithHandlesInfinity = 'abc'.startsWith('a', Infinity) === false;
      if (!startsWithRejectsRegex || !startsWithHandlesInfinity) {
        overrideNative(String.prototype, 'startsWith', StringPrototypeShims.startsWith);
        overrideNative(String.prototype, 'endsWith', StringPrototypeShims.endsWith);
      }
    }
    defineProperties(String.prototype, StringPrototypeShims);
    var ws = ['\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003', '\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028', '\u2029\uFEFF'].join('');
    var trimRegexp = new RegExp('(^[' + ws + ']+)|([' + ws + ']+$)', 'g');
    var trimShim = function trim() {
      if (typeof this === 'undefined' || this === null) {
        throw new TypeError("can't convert " + this + ' to object');
      }
      return String(this).replace(trimRegexp, '');
    };
    var nonWS = ['\u0085', '\u200b', '\ufffe'].join('');
    var nonWSregex = new RegExp('[' + nonWS + ']', 'g');
    var isBadHexRegex = /^[\-+]0x[0-9a-f]+$/i;
    var hasStringTrimBug = nonWS.trim().length !== nonWS.length;
    defineProperty(String.prototype, 'trim', trimShim, hasStringTrimBug);
    var StringIterator = function(s) {
      ES.RequireObjectCoercible(s);
      this._s = String(s);
      this._i = 0;
    };
    StringIterator.prototype.next = function() {
      var s = this._s,
          i = this._i;
      if (typeof s === 'undefined' || i >= s.length) {
        this._s = void 0;
        return {
          value: void 0,
          done: true
        };
      }
      var first = s.charCodeAt(i),
          second,
          len;
      if (first < 0xD800 || first > 0xDBFF || (i + 1) === s.length) {
        len = 1;
      } else {
        second = s.charCodeAt(i + 1);
        len = (second < 0xDC00 || second > 0xDFFF) ? 1 : 2;
      }
      this._i = i + len;
      return {
        value: s.substr(i, len),
        done: false
      };
    };
    addIterator(StringIterator.prototype);
    addIterator(String.prototype, function() {
      return new StringIterator(this);
    });
    var ArrayShims = {
      from: function from(items) {
        var C = this;
        var mapFn = arguments.length > 1 ? arguments[1] : void 0;
        var mapping,
            T;
        if (mapFn === void 0) {
          mapping = false;
        } else {
          if (!ES.IsCallable(mapFn)) {
            throw new TypeError('Array.from: when provided, the second argument must be a function');
          }
          T = arguments.length > 2 ? arguments[2] : void 0;
          mapping = true;
        }
        var usingIterator = typeof(isArguments(items) || ES.GetMethod(items, $iterator$)) !== 'undefined';
        var length,
            result,
            i;
        if (usingIterator) {
          result = ES.IsConstructor(C) ? Object(new C()) : [];
          var iterator = ES.GetIterator(items);
          var next,
              nextValue;
          i = 0;
          while (true) {
            next = ES.IteratorStep(iterator);
            if (next === false) {
              break;
            }
            nextValue = next.value;
            try {
              if (mapping) {
                nextValue = T === undefined ? mapFn(nextValue, i) : _call(mapFn, T, nextValue, i);
              }
              result[i] = nextValue;
            } catch (e) {
              ES.IteratorClose(iterator, true);
              throw e;
            }
            i += 1;
          }
          length = i;
        } else {
          var arrayLike = ES.ToObject(items);
          length = ES.ToLength(arrayLike.length);
          result = ES.IsConstructor(C) ? Object(new C(length)) : new Array(length);
          var value;
          for (i = 0; i < length; ++i) {
            value = arrayLike[i];
            if (mapping) {
              value = T !== undefined ? _call(mapFn, T, value, i) : mapFn(value, i);
            }
            result[i] = value;
          }
        }
        result.length = length;
        return result;
      },
      of: function of() {
        var len = arguments.length;
        var C = this;
        var A = isArray(C) || !ES.IsCallable(C) ? new Array(len) : ES.Construct(C, [len]);
        for (var k = 0; k < len; ++k) {
          createDataPropertyOrThrow(A, k, arguments[k]);
        }
        A.length = len;
        return A;
      }
    };
    defineProperties(Array, ArrayShims);
    addDefaultSpecies(Array);
    var iteratorResult = function(x) {
      return {
        value: x,
        done: arguments.length === 0
      };
    };
    ArrayIterator = function(array, kind) {
      this.i = 0;
      this.array = array;
      this.kind = kind;
    };
    defineProperties(ArrayIterator.prototype, {next: function() {
        var i = this.i,
            array = this.array;
        if (!(this instanceof ArrayIterator)) {
          throw new TypeError('Not an ArrayIterator');
        }
        if (typeof array !== 'undefined') {
          var len = ES.ToLength(array.length);
          for (; i < len; i++) {
            var kind = this.kind;
            var retval;
            if (kind === 'key') {
              retval = i;
            } else if (kind === 'value') {
              retval = array[i];
            } else if (kind === 'entry') {
              retval = [i, array[i]];
            }
            this.i = i + 1;
            return {
              value: retval,
              done: false
            };
          }
        }
        this.array = void 0;
        return {
          value: void 0,
          done: true
        };
      }});
    addIterator(ArrayIterator.prototype);
    var getAllKeys = function getAllKeys(object) {
      var keys = [];
      for (var key in object) {
        _push(keys, key);
      }
      return keys;
    };
    var ObjectIterator = function(object, kind) {
      defineProperties(this, {
        object: object,
        array: getAllKeys(object),
        kind: kind
      });
    };
    defineProperties(ObjectIterator.prototype, {next: function next() {
        var key;
        var array = this.array;
        if (!(this instanceof ObjectIterator)) {
          throw new TypeError('Not an ObjectIterator');
        }
        while (array.length > 0) {
          key = _shift(array);
          if (!(key in this.object)) {
            continue;
          }
          if (this.kind === 'key') {
            return iteratorResult(key);
          } else if (this.kind === 'value') {
            return iteratorResult(this.object[key]);
          } else {
            return iteratorResult([key, this.object[key]]);
          }
        }
        return iteratorResult();
      }});
    addIterator(ObjectIterator.prototype);
    var arrayOfSupportsSubclassing = Array.of === ArrayShims.of || (function() {
      var Foo = function Foo(len) {
        this.length = len;
      };
      Foo.prototype = [];
      var fooArr = Array.of.apply(Foo, [1, 2]);
      return fooArr instanceof Foo && fooArr.length === 2;
    }());
    if (!arrayOfSupportsSubclassing) {
      overrideNative(Array, 'of', ArrayShims.of);
    }
    var ArrayPrototypeShims = {
      copyWithin: function copyWithin(target, start) {
        var end = arguments[2];
        var o = ES.ToObject(this);
        var len = ES.ToLength(o.length);
        var relativeTarget = ES.ToInteger(target);
        var relativeStart = ES.ToInteger(start);
        var to = relativeTarget < 0 ? _max(len + relativeTarget, 0) : _min(relativeTarget, len);
        var from = relativeStart < 0 ? _max(len + relativeStart, 0) : _min(relativeStart, len);
        end = typeof end === 'undefined' ? len : ES.ToInteger(end);
        var fin = end < 0 ? _max(len + end, 0) : _min(end, len);
        var count = _min(fin - from, len - to);
        var direction = 1;
        if (from < to && to < (from + count)) {
          direction = -1;
          from += count - 1;
          to += count - 1;
        }
        while (count > 0) {
          if (_hasOwnProperty(o, from)) {
            o[to] = o[from];
          } else {
            delete o[from];
          }
          from += direction;
          to += direction;
          count -= 1;
        }
        return o;
      },
      fill: function fill(value) {
        var start = arguments.length > 1 ? arguments[1] : void 0;
        var end = arguments.length > 2 ? arguments[2] : void 0;
        var O = ES.ToObject(this);
        var len = ES.ToLength(O.length);
        start = ES.ToInteger(typeof start === 'undefined' ? 0 : start);
        end = ES.ToInteger(typeof end === 'undefined' ? len : end);
        var relativeStart = start < 0 ? _max(len + start, 0) : _min(start, len);
        var relativeEnd = end < 0 ? len + end : end;
        for (var i = relativeStart; i < len && i < relativeEnd; ++i) {
          O[i] = value;
        }
        return O;
      },
      find: function find(predicate) {
        var list = ES.ToObject(this);
        var length = ES.ToLength(list.length);
        if (!ES.IsCallable(predicate)) {
          throw new TypeError('Array#find: predicate must be a function');
        }
        var thisArg = arguments.length > 1 ? arguments[1] : null;
        for (var i = 0,
            value; i < length; i++) {
          value = list[i];
          if (thisArg) {
            if (_call(predicate, thisArg, value, i, list)) {
              return value;
            }
          } else if (predicate(value, i, list)) {
            return value;
          }
        }
      },
      findIndex: function findIndex(predicate) {
        var list = ES.ToObject(this);
        var length = ES.ToLength(list.length);
        if (!ES.IsCallable(predicate)) {
          throw new TypeError('Array#findIndex: predicate must be a function');
        }
        var thisArg = arguments.length > 1 ? arguments[1] : null;
        for (var i = 0; i < length; i++) {
          if (thisArg) {
            if (_call(predicate, thisArg, list[i], i, list)) {
              return i;
            }
          } else if (predicate(list[i], i, list)) {
            return i;
          }
        }
        return -1;
      },
      keys: function keys() {
        return new ArrayIterator(this, 'key');
      },
      values: function values() {
        return new ArrayIterator(this, 'value');
      },
      entries: function entries() {
        return new ArrayIterator(this, 'entry');
      }
    };
    if (Array.prototype.keys && !ES.IsCallable([1].keys().next)) {
      delete Array.prototype.keys;
    }
    if (Array.prototype.entries && !ES.IsCallable([1].entries().next)) {
      delete Array.prototype.entries;
    }
    if (Array.prototype.keys && Array.prototype.entries && !Array.prototype.values && Array.prototype[$iterator$]) {
      defineProperties(Array.prototype, {values: Array.prototype[$iterator$]});
      if (Type.symbol(Symbol.unscopables)) {
        Array.prototype[Symbol.unscopables].values = true;
      }
    }
    if (functionsHaveNames && Array.prototype.values && Array.prototype.values.name !== 'values') {
      var originalArrayPrototypeValues = Array.prototype.values;
      overrideNative(Array.prototype, 'values', function values() {
        return _call(originalArrayPrototypeValues, this);
      });
      defineProperty(Array.prototype, $iterator$, Array.prototype.values, true);
    }
    defineProperties(Array.prototype, ArrayPrototypeShims);
    addIterator(Array.prototype, function() {
      return this.values();
    });
    if (Object.getPrototypeOf) {
      addIterator(Object.getPrototypeOf([].values()));
    }
    var arrayFromSwallowsNegativeLengths = (function() {
      return valueOrFalseIfThrows(function() {
        return Array.from({length: -1}).length === 0;
      });
    }());
    var arrayFromHandlesIterables = (function() {
      var arr = Array.from([0].entries());
      return arr.length === 1 && isArray(arr[0]) && arr[0][0] === 0 && arr[0][1] === 0;
    }());
    if (!arrayFromSwallowsNegativeLengths || !arrayFromHandlesIterables) {
      overrideNative(Array, 'from', ArrayShims.from);
    }
    var arrayFromHandlesUndefinedMapFunction = (function() {
      return valueOrFalseIfThrows(function() {
        return Array.from([0], undefined);
      });
    }());
    if (!arrayFromHandlesUndefinedMapFunction) {
      var origArrayFrom = Array.from;
      overrideNative(Array, 'from', function from(items) {
        if (arguments.length > 0 && typeof arguments[1] !== 'undefined') {
          return _apply(origArrayFrom, this, arguments);
        } else {
          return _call(origArrayFrom, this, items);
        }
      });
    }
    var toLengthsCorrectly = function(method, reversed) {
      var obj = {length: -1};
      obj[reversed ? ((-1 >>> 0) - 1) : 0] = true;
      return valueOrFalseIfThrows(function() {
        _call(method, obj, function() {
          throw new RangeError('should not reach here');
        }, []);
      });
    };
    if (!toLengthsCorrectly(Array.prototype.forEach)) {
      var originalForEach = Array.prototype.forEach;
      overrideNative(Array.prototype, 'forEach', function forEach(callbackFn) {
        return _apply(originalForEach, this.length >= 0 ? this : [], arguments);
      }, true);
    }
    if (!toLengthsCorrectly(Array.prototype.map)) {
      var originalMap = Array.prototype.map;
      overrideNative(Array.prototype, 'map', function map(callbackFn) {
        return _apply(originalMap, this.length >= 0 ? this : [], arguments);
      }, true);
    }
    if (!toLengthsCorrectly(Array.prototype.filter)) {
      var originalFilter = Array.prototype.filter;
      overrideNative(Array.prototype, 'filter', function filter(callbackFn) {
        return _apply(originalFilter, this.length >= 0 ? this : [], arguments);
      }, true);
    }
    if (!toLengthsCorrectly(Array.prototype.some)) {
      var originalSome = Array.prototype.some;
      overrideNative(Array.prototype, 'some', function some(callbackFn) {
        return _apply(originalSome, this.length >= 0 ? this : [], arguments);
      }, true);
    }
    if (!toLengthsCorrectly(Array.prototype.every)) {
      var originalEvery = Array.prototype.every;
      overrideNative(Array.prototype, 'every', function every(callbackFn) {
        return _apply(originalEvery, this.length >= 0 ? this : [], arguments);
      }, true);
    }
    if (!toLengthsCorrectly(Array.prototype.reduce)) {
      var originalReduce = Array.prototype.reduce;
      overrideNative(Array.prototype, 'reduce', function reduce(callbackFn) {
        return _apply(originalReduce, this.length >= 0 ? this : [], arguments);
      }, true);
    }
    if (!toLengthsCorrectly(Array.prototype.reduceRight, true)) {
      var originalReduceRight = Array.prototype.reduceRight;
      overrideNative(Array.prototype, 'reduceRight', function reduceRight(callbackFn) {
        return _apply(originalReduceRight, this.length >= 0 ? this : [], arguments);
      }, true);
    }
    var lacksOctalSupport = Number('0o10') !== 8;
    var lacksBinarySupport = Number('0b10') !== 2;
    var trimsNonWhitespace = _some(nonWS, function(c) {
      return Number(c + 0 + c) === 0;
    });
    if (lacksOctalSupport || lacksBinarySupport || trimsNonWhitespace) {
      var OrigNumber = Number;
      var binaryRegex = /^0b[01]+$/i;
      var octalRegex = /^0o[0-7]+$/i;
      var isBinary = binaryRegex.test.bind(binaryRegex);
      var isOctal = octalRegex.test.bind(octalRegex);
      var toPrimitive = function(O) {
        var result;
        if (typeof O.valueOf === 'function') {
          result = O.valueOf();
          if (Type.primitive(result)) {
            return result;
          }
        }
        if (typeof O.toString === 'function') {
          result = O.toString();
          if (Type.primitive(result)) {
            return result;
          }
        }
        throw new TypeError('No default value');
      };
      var hasNonWS = nonWSregex.test.bind(nonWSregex);
      var isBadHex = isBadHexRegex.test.bind(isBadHexRegex);
      var NumberShim = (function() {
        var NumberShim = function Number(value) {
          var primValue;
          if (arguments.length > 0) {
            primValue = Type.primitive(value) ? value : toPrimitive(value, 'number');
          } else {
            primValue = 0;
          }
          if (typeof primValue === 'string') {
            primValue = _call(trimShim, primValue);
            if (isBinary(primValue)) {
              primValue = parseInt(_strSlice(primValue, 2), 2);
            } else if (isOctal(primValue)) {
              primValue = parseInt(_strSlice(primValue, 2), 8);
            } else if (hasNonWS(primValue) || isBadHex(primValue)) {
              primValue = NaN;
            }
          }
          var receiver = this;
          var valueOfSucceeds = valueOrFalseIfThrows(function() {
            OrigNumber.prototype.valueOf.call(receiver);
            return true;
          });
          if (receiver instanceof NumberShim && !valueOfSucceeds) {
            return new OrigNumber(primValue);
          }
          return OrigNumber(primValue);
        };
        return NumberShim;
      }());
      wrapConstructor(OrigNumber, NumberShim, {});
      Number = NumberShim;
      Value.redefine(globals, 'Number', NumberShim);
    }
    var maxSafeInteger = Math.pow(2, 53) - 1;
    defineProperties(Number, {
      MAX_SAFE_INTEGER: maxSafeInteger,
      MIN_SAFE_INTEGER: -maxSafeInteger,
      EPSILON: 2.220446049250313e-16,
      parseInt: globals.parseInt,
      parseFloat: globals.parseFloat,
      isFinite: numberIsFinite,
      isInteger: function isInteger(value) {
        return numberIsFinite(value) && ES.ToInteger(value) === value;
      },
      isSafeInteger: function isSafeInteger(value) {
        return Number.isInteger(value) && _abs(value) <= Number.MAX_SAFE_INTEGER;
      },
      isNaN: numberIsNaN
    });
    defineProperty(Number, 'parseInt', globals.parseInt, Number.parseInt !== globals.parseInt);
    if (![, 1].find(function(item, idx) {
      return idx === 0;
    })) {
      overrideNative(Array.prototype, 'find', ArrayPrototypeShims.find);
    }
    if ([, 1].findIndex(function(item, idx) {
      return idx === 0;
    }) !== 0) {
      overrideNative(Array.prototype, 'findIndex', ArrayPrototypeShims.findIndex);
    }
    var isEnumerableOn = Function.bind.call(Function.bind, Object.prototype.propertyIsEnumerable);
    var sliceArgs = function sliceArgs() {
      var initial = Number(this);
      var len = arguments.length;
      var desiredArgCount = len - initial;
      var args = new Array(desiredArgCount < 0 ? 0 : desiredArgCount);
      for (var i = initial; i < len; ++i) {
        args[i - initial] = arguments[i];
      }
      return args;
    };
    var assignTo = function assignTo(source) {
      return function assignToSource(target, key) {
        target[key] = source[key];
        return target;
      };
    };
    var assignReducer = function(target, source) {
      var keys = Object.keys(Object(source));
      var symbols;
      if (ES.IsCallable(Object.getOwnPropertySymbols)) {
        symbols = _filter(Object.getOwnPropertySymbols(Object(source)), isEnumerableOn(source));
      }
      return _reduce(_concat(keys, symbols || []), assignTo(source), target);
    };
    var ObjectShims = {
      assign: function(target, source) {
        var to = ES.ToObject(target, 'Cannot convert undefined or null to object');
        return _reduce(_apply(sliceArgs, 1, arguments), assignReducer, to);
      },
      is: function is(a, b) {
        return ES.SameValue(a, b);
      }
    };
    var assignHasPendingExceptions = Object.assign && Object.preventExtensions && (function() {
      var thrower = Object.preventExtensions({1: 2});
      try {
        Object.assign(thrower, 'xy');
      } catch (e) {
        return thrower[1] === 'y';
      }
    }());
    if (assignHasPendingExceptions) {
      overrideNative(Object, 'assign', ObjectShims.assign);
    }
    defineProperties(Object, ObjectShims);
    if (supportsDescriptors) {
      var ES5ObjectShims = {setPrototypeOf: (function(Object, magic) {
          var set;
          var checkArgs = function(O, proto) {
            if (!ES.TypeIsObject(O)) {
              throw new TypeError('cannot set prototype on a non-object');
            }
            if (!(proto === null || ES.TypeIsObject(proto))) {
              throw new TypeError('can only set prototype to an object or null' + proto);
            }
          };
          var setPrototypeOf = function(O, proto) {
            checkArgs(O, proto);
            _call(set, O, proto);
            return O;
          };
          try {
            set = Object.getOwnPropertyDescriptor(Object.prototype, magic).set;
            _call(set, {}, null);
          } catch (e) {
            if (Object.prototype !== {}[magic]) {
              return;
            }
            set = function(proto) {
              this[magic] = proto;
            };
            setPrototypeOf.polyfill = setPrototypeOf(setPrototypeOf({}, null), Object.prototype) instanceof Object;
          }
          return setPrototypeOf;
        }(Object, '__proto__'))};
      defineProperties(Object, ES5ObjectShims);
    }
    if (Object.setPrototypeOf && Object.getPrototypeOf && Object.getPrototypeOf(Object.setPrototypeOf({}, null)) !== null && Object.getPrototypeOf(Object.create(null)) === null) {
      (function() {
        var FAKENULL = Object.create(null);
        var gpo = Object.getPrototypeOf,
            spo = Object.setPrototypeOf;
        Object.getPrototypeOf = function(o) {
          var result = gpo(o);
          return result === FAKENULL ? null : result;
        };
        Object.setPrototypeOf = function(o, p) {
          var proto = p === null ? FAKENULL : p;
          return spo(o, proto);
        };
        Object.setPrototypeOf.polyfill = false;
      }());
    }
    var objectKeysAcceptsPrimitives = !throwsError(function() {
      Object.keys('foo');
    });
    if (!objectKeysAcceptsPrimitives) {
      var originalObjectKeys = Object.keys;
      overrideNative(Object, 'keys', function keys(value) {
        return originalObjectKeys(ES.ToObject(value));
      });
    }
    if (Object.getOwnPropertyNames) {
      var objectGOPNAcceptsPrimitives = !throwsError(function() {
        Object.getOwnPropertyNames('foo');
      });
      if (!objectGOPNAcceptsPrimitives) {
        var cachedWindowNames = typeof window === 'object' ? Object.getOwnPropertyNames(window) : [];
        var originalObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
        overrideNative(Object, 'getOwnPropertyNames', function getOwnPropertyNames(value) {
          var val = ES.ToObject(value);
          if (_toString(val) === '[object Window]') {
            try {
              return originalObjectGetOwnPropertyNames(val);
            } catch (e) {
              return _concat([], cachedWindowNames);
            }
          }
          return originalObjectGetOwnPropertyNames(val);
        });
      }
    }
    if (Object.getOwnPropertyDescriptor) {
      var objectGOPDAcceptsPrimitives = !throwsError(function() {
        Object.getOwnPropertyDescriptor('foo', 'bar');
      });
      if (!objectGOPDAcceptsPrimitives) {
        var originalObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
        overrideNative(Object, 'getOwnPropertyDescriptor', function getOwnPropertyDescriptor(value, property) {
          return originalObjectGetOwnPropertyDescriptor(ES.ToObject(value), property);
        });
      }
    }
    if (Object.seal) {
      var objectSealAcceptsPrimitives = !throwsError(function() {
        Object.seal('foo');
      });
      if (!objectSealAcceptsPrimitives) {
        var originalObjectSeal = Object.seal;
        overrideNative(Object, 'seal', function seal(value) {
          if (!Type.object(value)) {
            return value;
          }
          return originalObjectSeal(value);
        });
      }
    }
    if (Object.isSealed) {
      var objectIsSealedAcceptsPrimitives = !throwsError(function() {
        Object.isSealed('foo');
      });
      if (!objectIsSealedAcceptsPrimitives) {
        var originalObjectIsSealed = Object.isSealed;
        overrideNative(Object, 'isSealed', function isSealed(value) {
          if (!Type.object(value)) {
            return true;
          }
          return originalObjectIsSealed(value);
        });
      }
    }
    if (Object.freeze) {
      var objectFreezeAcceptsPrimitives = !throwsError(function() {
        Object.freeze('foo');
      });
      if (!objectFreezeAcceptsPrimitives) {
        var originalObjectFreeze = Object.freeze;
        overrideNative(Object, 'freeze', function freeze(value) {
          if (!Type.object(value)) {
            return value;
          }
          return originalObjectFreeze(value);
        });
      }
    }
    if (Object.isFrozen) {
      var objectIsFrozenAcceptsPrimitives = !throwsError(function() {
        Object.isFrozen('foo');
      });
      if (!objectIsFrozenAcceptsPrimitives) {
        var originalObjectIsFrozen = Object.isFrozen;
        overrideNative(Object, 'isFrozen', function isFrozen(value) {
          if (!Type.object(value)) {
            return true;
          }
          return originalObjectIsFrozen(value);
        });
      }
    }
    if (Object.preventExtensions) {
      var objectPreventExtensionsAcceptsPrimitives = !throwsError(function() {
        Object.preventExtensions('foo');
      });
      if (!objectPreventExtensionsAcceptsPrimitives) {
        var originalObjectPreventExtensions = Object.preventExtensions;
        overrideNative(Object, 'preventExtensions', function preventExtensions(value) {
          if (!Type.object(value)) {
            return value;
          }
          return originalObjectPreventExtensions(value);
        });
      }
    }
    if (Object.isExtensible) {
      var objectIsExtensibleAcceptsPrimitives = !throwsError(function() {
        Object.isExtensible('foo');
      });
      if (!objectIsExtensibleAcceptsPrimitives) {
        var originalObjectIsExtensible = Object.isExtensible;
        overrideNative(Object, 'isExtensible', function isExtensible(value) {
          if (!Type.object(value)) {
            return false;
          }
          return originalObjectIsExtensible(value);
        });
      }
    }
    if (Object.getPrototypeOf) {
      var objectGetProtoAcceptsPrimitives = !throwsError(function() {
        Object.getPrototypeOf('foo');
      });
      if (!objectGetProtoAcceptsPrimitives) {
        var originalGetProto = Object.getPrototypeOf;
        overrideNative(Object, 'getPrototypeOf', function getPrototypeOf(value) {
          return originalGetProto(ES.ToObject(value));
        });
      }
    }
    var hasFlags = supportsDescriptors && (function() {
      var desc = Object.getOwnPropertyDescriptor(RegExp.prototype, 'flags');
      return desc && ES.IsCallable(desc.get);
    }());
    if (supportsDescriptors && !hasFlags) {
      var regExpFlagsGetter = function flags() {
        if (!ES.TypeIsObject(this)) {
          throw new TypeError('Method called on incompatible type: must be an object.');
        }
        var result = '';
        if (this.global) {
          result += 'g';
        }
        if (this.ignoreCase) {
          result += 'i';
        }
        if (this.multiline) {
          result += 'm';
        }
        if (this.unicode) {
          result += 'u';
        }
        if (this.sticky) {
          result += 'y';
        }
        return result;
      };
      Value.getter(RegExp.prototype, 'flags', regExpFlagsGetter);
    }
    var regExpSupportsFlagsWithRegex = valueOrFalseIfThrows(function() {
      return String(new RegExp(/a/g, 'i')) === '/a/i';
    });
    if (!regExpSupportsFlagsWithRegex && supportsDescriptors) {
      var OrigRegExp = RegExp;
      var RegExpShim = (function() {
        return function RegExp(pattern, flags) {
          var calledWithNew = this instanceof RegExp;
          if (!calledWithNew && (Type.regex(pattern) || (pattern && pattern.constructor === RegExp))) {
            return pattern;
          }
          if (Type.regex(pattern) && Type.string(flags)) {
            return new RegExp(pattern.source, flags);
          }
          return new OrigRegExp(pattern, flags);
        };
      }());
      wrapConstructor(OrigRegExp, RegExpShim, {$input: true});
      RegExp = RegExpShim;
      Value.redefine(globals, 'RegExp', RegExpShim);
    }
    if (supportsDescriptors) {
      var regexGlobals = {
        input: '$_',
        lastMatch: '$&',
        lastParen: '$+',
        leftContext: '$`',
        rightContext: '$\''
      };
      _forEach(Object.keys(regexGlobals), function(prop) {
        if (prop in RegExp && !(regexGlobals[prop] in RegExp)) {
          Value.getter(RegExp, regexGlobals[prop], function get() {
            return RegExp[prop];
          });
        }
      });
    }
    addDefaultSpecies(RegExp);
    var inverseEpsilon = 1 / Number.EPSILON;
    var roundTiesToEven = function roundTiesToEven(n) {
      return (n + inverseEpsilon) - inverseEpsilon;
    };
    var BINARY_32_EPSILON = Math.pow(2, -23);
    var BINARY_32_MAX_VALUE = Math.pow(2, 127) * (2 - BINARY_32_EPSILON);
    var BINARY_32_MIN_VALUE = Math.pow(2, -126);
    var numberCLZ = Number.prototype.clz;
    delete Number.prototype.clz;
    var MathShims = {
      acosh: function acosh(value) {
        var x = Number(value);
        if (Number.isNaN(x) || value < 1) {
          return NaN;
        }
        if (x === 1) {
          return 0;
        }
        if (x === Infinity) {
          return x;
        }
        return _log(x / Math.E + _sqrt(x + 1) * _sqrt(x - 1) / Math.E) + 1;
      },
      asinh: function asinh(value) {
        var x = Number(value);
        if (x === 0 || !globalIsFinite(x)) {
          return x;
        }
        return x < 0 ? -Math.asinh(-x) : _log(x + _sqrt(x * x + 1));
      },
      atanh: function atanh(value) {
        var x = Number(value);
        if (Number.isNaN(x) || x < -1 || x > 1) {
          return NaN;
        }
        if (x === -1) {
          return -Infinity;
        }
        if (x === 1) {
          return Infinity;
        }
        if (x === 0) {
          return x;
        }
        return 0.5 * _log((1 + x) / (1 - x));
      },
      cbrt: function cbrt(value) {
        var x = Number(value);
        if (x === 0) {
          return x;
        }
        var negate = x < 0,
            result;
        if (negate) {
          x = -x;
        }
        if (x === Infinity) {
          result = Infinity;
        } else {
          result = Math.exp(_log(x) / 3);
          result = (x / (result * result) + (2 * result)) / 3;
        }
        return negate ? -result : result;
      },
      clz32: function clz32(value) {
        var x = Number(value);
        var number = ES.ToUint32(x);
        if (number === 0) {
          return 32;
        }
        return numberCLZ ? _call(numberCLZ, number) : 31 - _floor(_log(number + 0.5) * Math.LOG2E);
      },
      cosh: function cosh(value) {
        var x = Number(value);
        if (x === 0) {
          return 1;
        }
        if (Number.isNaN(x)) {
          return NaN;
        }
        if (!globalIsFinite(x)) {
          return Infinity;
        }
        if (x < 0) {
          x = -x;
        }
        if (x > 21) {
          return Math.exp(x) / 2;
        }
        return (Math.exp(x) + Math.exp(-x)) / 2;
      },
      expm1: function expm1(value) {
        var x = Number(value);
        if (x === -Infinity) {
          return -1;
        }
        if (!globalIsFinite(x) || x === 0) {
          return x;
        }
        if (_abs(x) > 0.5) {
          return Math.exp(x) - 1;
        }
        var t = x;
        var sum = 0;
        var n = 1;
        while (sum + t !== sum) {
          sum += t;
          n += 1;
          t *= x / n;
        }
        return sum;
      },
      hypot: function hypot(x, y) {
        var result = 0;
        var largest = 0;
        for (var i = 0; i < arguments.length; ++i) {
          var value = _abs(Number(arguments[i]));
          if (largest < value) {
            result *= (largest / value) * (largest / value);
            result += 1;
            largest = value;
          } else {
            result += (value > 0 ? (value / largest) * (value / largest) : value);
          }
        }
        return largest === Infinity ? Infinity : largest * _sqrt(result);
      },
      log2: function log2(value) {
        return _log(value) * Math.LOG2E;
      },
      log10: function log10(value) {
        return _log(value) * Math.LOG10E;
      },
      log1p: function log1p(value) {
        var x = Number(value);
        if (x < -1 || Number.isNaN(x)) {
          return NaN;
        }
        if (x === 0 || x === Infinity) {
          return x;
        }
        if (x === -1) {
          return -Infinity;
        }
        return (1 + x) - 1 === 0 ? x : x * (_log(1 + x) / ((1 + x) - 1));
      },
      sign: function sign(value) {
        var number = Number(value);
        if (number === 0) {
          return number;
        }
        if (Number.isNaN(number)) {
          return number;
        }
        return number < 0 ? -1 : 1;
      },
      sinh: function sinh(value) {
        var x = Number(value);
        if (!globalIsFinite(x) || x === 0) {
          return x;
        }
        if (_abs(x) < 1) {
          return (Math.expm1(x) - Math.expm1(-x)) / 2;
        }
        return (Math.exp(x - 1) - Math.exp(-x - 1)) * Math.E / 2;
      },
      tanh: function tanh(value) {
        var x = Number(value);
        if (Number.isNaN(x) || x === 0) {
          return x;
        }
        if (x === Infinity) {
          return 1;
        }
        if (x === -Infinity) {
          return -1;
        }
        var a = Math.expm1(x);
        var b = Math.expm1(-x);
        if (a === Infinity) {
          return 1;
        }
        if (b === Infinity) {
          return -1;
        }
        return (a - b) / (Math.exp(x) + Math.exp(-x));
      },
      trunc: function trunc(value) {
        var x = Number(value);
        return x < 0 ? -_floor(-x) : _floor(x);
      },
      imul: function imul(x, y) {
        var a = ES.ToUint32(x);
        var b = ES.ToUint32(y);
        var ah = (a >>> 16) & 0xffff;
        var al = a & 0xffff;
        var bh = (b >>> 16) & 0xffff;
        var bl = b & 0xffff;
        return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0) | 0);
      },
      fround: function fround(x) {
        var v = Number(x);
        if (v === 0 || v === Infinity || v === -Infinity || numberIsNaN(v)) {
          return v;
        }
        var sign = Math.sign(v);
        var abs = _abs(v);
        if (abs < BINARY_32_MIN_VALUE) {
          return sign * roundTiesToEven(abs / BINARY_32_MIN_VALUE / BINARY_32_EPSILON) * BINARY_32_MIN_VALUE * BINARY_32_EPSILON;
        }
        var a = (1 + BINARY_32_EPSILON / Number.EPSILON) * abs;
        var result = a - (a - abs);
        if (result > BINARY_32_MAX_VALUE || numberIsNaN(result)) {
          return sign * Infinity;
        }
        return sign * result;
      }
    };
    defineProperties(Math, MathShims);
    defineProperty(Math, 'log1p', MathShims.log1p, Math.log1p(-1e-17) !== -1e-17);
    defineProperty(Math, 'asinh', MathShims.asinh, Math.asinh(-1e7) !== -Math.asinh(1e7));
    defineProperty(Math, 'tanh', MathShims.tanh, Math.tanh(-2e-17) !== -2e-17);
    defineProperty(Math, 'acosh', MathShims.acosh, Math.acosh(Number.MAX_VALUE) === Infinity);
    defineProperty(Math, 'cbrt', MathShims.cbrt, Math.abs(1 - Math.cbrt(1e-300) / 1e-100) / Number.EPSILON > 8);
    defineProperty(Math, 'sinh', MathShims.sinh, Math.sinh(-2e-17) !== -2e-17);
    var expm1OfTen = Math.expm1(10);
    defineProperty(Math, 'expm1', MathShims.expm1, expm1OfTen > 22025.465794806719 || expm1OfTen < 22025.4657948067165168);
    var origMathRound = Math.round;
    var roundHandlesBoundaryConditions = Math.round(0.5 - Number.EPSILON / 4) === 0 && Math.round(-0.5 + Number.EPSILON / 3.99) === 1;
    var smallestPositiveNumberWhereRoundBreaks = inverseEpsilon + 1;
    var largestPositiveNumberWhereRoundBreaks = 2 * inverseEpsilon - 1;
    var roundDoesNotIncreaseIntegers = [smallestPositiveNumberWhereRoundBreaks, largestPositiveNumberWhereRoundBreaks].every(function(num) {
      return Math.round(num) === num;
    });
    defineProperty(Math, 'round', function round(x) {
      var floor = _floor(x);
      var ceil = floor === -1 ? -0 : floor + 1;
      return x - floor < 0.5 ? floor : ceil;
    }, !roundHandlesBoundaryConditions || !roundDoesNotIncreaseIntegers);
    Value.preserveToString(Math.round, origMathRound);
    var origImul = Math.imul;
    if (Math.imul(0xffffffff, 5) !== -5) {
      Math.imul = MathShims.imul;
      Value.preserveToString(Math.imul, origImul);
    }
    if (Math.imul.length !== 2) {
      overrideNative(Math, 'imul', function imul(x, y) {
        return _apply(origImul, Math, arguments);
      });
    }
    var PromiseShim = (function() {
      var setTimeout = globals.setTimeout;
      if (typeof setTimeout !== 'function' && typeof setTimeout !== 'object') {
        return;
      }
      ES.IsPromise = function(promise) {
        if (!ES.TypeIsObject(promise)) {
          return false;
        }
        if (typeof promise._promise === 'undefined') {
          return false;
        }
        return true;
      };
      var PromiseCapability = function(C) {
        if (!ES.IsConstructor(C)) {
          throw new TypeError('Bad promise constructor');
        }
        var capability = this;
        var resolver = function(resolve, reject) {
          if (capability.resolve !== void 0 || capability.reject !== void 0) {
            throw new TypeError('Bad Promise implementation!');
          }
          capability.resolve = resolve;
          capability.reject = reject;
        };
        capability.promise = new C(resolver);
        if (!(ES.IsCallable(capability.resolve) && ES.IsCallable(capability.reject))) {
          throw new TypeError('Bad promise constructor');
        }
      };
      var makeZeroTimeout;
      if (typeof window !== 'undefined' && ES.IsCallable(window.postMessage)) {
        makeZeroTimeout = function() {
          var timeouts = [];
          var messageName = 'zero-timeout-message';
          var setZeroTimeout = function(fn) {
            _push(timeouts, fn);
            window.postMessage(messageName, '*');
          };
          var handleMessage = function(event) {
            if (event.source === window && event.data === messageName) {
              event.stopPropagation();
              if (timeouts.length === 0) {
                return;
              }
              var fn = _shift(timeouts);
              fn();
            }
          };
          window.addEventListener('message', handleMessage, true);
          return setZeroTimeout;
        };
      }
      var makePromiseAsap = function() {
        var P = globals.Promise;
        return P && P.resolve && function(task) {
          return P.resolve().then(task);
        };
      };
      var enqueue = ES.IsCallable(globals.setImmediate) ? globals.setImmediate.bind(globals) : typeof process === 'object' && process.nextTick ? process.nextTick : makePromiseAsap() || (ES.IsCallable(makeZeroTimeout) ? makeZeroTimeout() : function(task) {
        setTimeout(task, 0);
      });
      var PROMISE_IDENTITY = 1;
      var PROMISE_THROWER = 2;
      var PROMISE_PENDING = 3;
      var PROMISE_FULFILLED = 4;
      var PROMISE_REJECTED = 5;
      var promiseReactionJob = function(reaction, argument) {
        var promiseCapability = reaction.capabilities;
        var handler = reaction.handler;
        var handlerResult,
            handlerException = false,
            f;
        if (handler === PROMISE_IDENTITY) {
          handlerResult = argument;
        } else if (handler === PROMISE_THROWER) {
          handlerResult = argument;
          handlerException = true;
        } else {
          try {
            handlerResult = handler(argument);
          } catch (e) {
            handlerResult = e;
            handlerException = true;
          }
        }
        f = handlerException ? promiseCapability.reject : promiseCapability.resolve;
        f(handlerResult);
      };
      var triggerPromiseReactions = function(reactions, argument) {
        _forEach(reactions, function(reaction) {
          enqueue(function() {
            promiseReactionJob(reaction, argument);
          });
        });
      };
      var fulfillPromise = function(promise, value) {
        var _promise = promise._promise;
        var reactions = _promise.fulfillReactions;
        _promise.result = value;
        _promise.fulfillReactions = void 0;
        _promise.rejectReactions = void 0;
        _promise.state = PROMISE_FULFILLED;
        triggerPromiseReactions(reactions, value);
      };
      var rejectPromise = function(promise, reason) {
        var _promise = promise._promise;
        var reactions = _promise.rejectReactions;
        _promise.result = reason;
        _promise.fulfillReactions = void 0;
        _promise.rejectReactions = void 0;
        _promise.state = PROMISE_REJECTED;
        triggerPromiseReactions(reactions, reason);
      };
      var createResolvingFunctions = function(promise) {
        var alreadyResolved = false;
        var resolve = function(resolution) {
          var then;
          if (alreadyResolved) {
            return;
          }
          alreadyResolved = true;
          if (resolution === promise) {
            return rejectPromise(promise, new TypeError('Self resolution'));
          }
          if (!ES.TypeIsObject(resolution)) {
            return fulfillPromise(promise, resolution);
          }
          try {
            then = resolution.then;
          } catch (e) {
            return rejectPromise(promise, e);
          }
          if (!ES.IsCallable(then)) {
            return fulfillPromise(promise, resolution);
          }
          enqueue(function() {
            promiseResolveThenableJob(promise, resolution, then);
          });
        };
        var reject = function(reason) {
          if (alreadyResolved) {
            return;
          }
          alreadyResolved = true;
          return rejectPromise(promise, reason);
        };
        return {
          resolve: resolve,
          reject: reject
        };
      };
      var promiseResolveThenableJob = function(promise, thenable, then) {
        var resolvingFunctions = createResolvingFunctions(promise);
        var resolve = resolvingFunctions.resolve;
        var reject = resolvingFunctions.reject;
        try {
          _call(then, thenable, resolve, reject);
        } catch (e) {
          reject(e);
        }
      };
      var getPromiseSpecies = function(C) {
        if (!ES.TypeIsObject(C)) {
          throw new TypeError('Promise is not object');
        }
        var S = C[symbolSpecies];
        if (S !== void 0 && S !== null) {
          return S;
        }
        return C;
      };
      var Promise$prototype;
      var Promise = (function() {
        var PromiseShim = function Promise(resolver) {
          if (!(this instanceof PromiseShim)) {
            throw new TypeError('Constructor Promise requires "new"');
          }
          if (this && this._promise) {
            throw new TypeError('Bad construction');
          }
          if (!ES.IsCallable(resolver)) {
            throw new TypeError('not a valid resolver');
          }
          var promise = emulateES6construct(this, PromiseShim, Promise$prototype, {_promise: {
              result: void 0,
              state: PROMISE_PENDING,
              fulfillReactions: [],
              rejectReactions: []
            }});
          var resolvingFunctions = createResolvingFunctions(promise);
          var reject = resolvingFunctions.reject;
          try {
            resolver(resolvingFunctions.resolve, reject);
          } catch (e) {
            reject(e);
          }
          return promise;
        };
        return PromiseShim;
      }());
      Promise$prototype = Promise.prototype;
      var _promiseAllResolver = function(index, values, capability, remaining) {
        var alreadyCalled = false;
        return function(x) {
          if (alreadyCalled) {
            return;
          }
          alreadyCalled = true;
          values[index] = x;
          if ((--remaining.count) === 0) {
            var resolve = capability.resolve;
            resolve(values);
          }
        };
      };
      var performPromiseAll = function(iteratorRecord, C, resultCapability) {
        var it = iteratorRecord.iterator;
        var values = [],
            remaining = {count: 1},
            next,
            nextValue;
        var index = 0;
        while (true) {
          try {
            next = ES.IteratorStep(it);
            if (next === false) {
              iteratorRecord.done = true;
              break;
            }
            nextValue = next.value;
          } catch (e) {
            iteratorRecord.done = true;
            throw e;
          }
          values[index] = void 0;
          var nextPromise = C.resolve(nextValue);
          var resolveElement = _promiseAllResolver(index, values, resultCapability, remaining);
          remaining.count += 1;
          nextPromise.then(resolveElement, resultCapability.reject);
          index += 1;
        }
        if ((--remaining.count) === 0) {
          var resolve = resultCapability.resolve;
          resolve(values);
        }
        return resultCapability.promise;
      };
      var performPromiseRace = function(iteratorRecord, C, resultCapability) {
        var it = iteratorRecord.iterator,
            next,
            nextValue,
            nextPromise;
        while (true) {
          try {
            next = ES.IteratorStep(it);
            if (next === false) {
              iteratorRecord.done = true;
              break;
            }
            nextValue = next.value;
          } catch (e) {
            iteratorRecord.done = true;
            throw e;
          }
          nextPromise = C.resolve(nextValue);
          nextPromise.then(resultCapability.resolve, resultCapability.reject);
        }
        return resultCapability.promise;
      };
      defineProperties(Promise, {
        all: function all(iterable) {
          var C = getPromiseSpecies(this);
          var capability = new PromiseCapability(C);
          var iterator,
              iteratorRecord;
          try {
            iterator = ES.GetIterator(iterable);
            iteratorRecord = {
              iterator: iterator,
              done: false
            };
            return performPromiseAll(iteratorRecord, C, capability);
          } catch (e) {
            var exception = e;
            if (iteratorRecord && !iteratorRecord.done) {
              try {
                ES.IteratorClose(iterator, true);
              } catch (ee) {
                exception = ee;
              }
            }
            var reject = capability.reject;
            reject(exception);
            return capability.promise;
          }
        },
        race: function race(iterable) {
          var C = getPromiseSpecies(this);
          var capability = new PromiseCapability(C);
          var iterator,
              iteratorRecord;
          try {
            iterator = ES.GetIterator(iterable);
            iteratorRecord = {
              iterator: iterator,
              done: false
            };
            return performPromiseRace(iteratorRecord, C, capability);
          } catch (e) {
            var exception = e;
            if (iteratorRecord && !iteratorRecord.done) {
              try {
                ES.IteratorClose(iterator, true);
              } catch (ee) {
                exception = ee;
              }
            }
            var reject = capability.reject;
            reject(exception);
            return capability.promise;
          }
        },
        reject: function reject(reason) {
          var C = this;
          var capability = new PromiseCapability(C);
          var rejectFunc = capability.reject;
          rejectFunc(reason);
          return capability.promise;
        },
        resolve: function resolve(v) {
          var C = this;
          if (ES.IsPromise(v)) {
            var constructor = v.constructor;
            if (constructor === C) {
              return v;
            }
          }
          var capability = new PromiseCapability(C);
          var resolveFunc = capability.resolve;
          resolveFunc(v);
          return capability.promise;
        }
      });
      defineProperties(Promise$prototype, {
        'catch': function(onRejected) {
          return this.then(void 0, onRejected);
        },
        then: function then(onFulfilled, onRejected) {
          var promise = this;
          if (!ES.IsPromise(promise)) {
            throw new TypeError('not a promise');
          }
          var C = ES.SpeciesConstructor(promise, Promise);
          var resultCapability = new PromiseCapability(C);
          var fulfillReaction = {
            capabilities: resultCapability,
            handler: ES.IsCallable(onFulfilled) ? onFulfilled : PROMISE_IDENTITY
          };
          var rejectReaction = {
            capabilities: resultCapability,
            handler: ES.IsCallable(onRejected) ? onRejected : PROMISE_THROWER
          };
          var _promise = promise._promise;
          var value;
          if (_promise.state === PROMISE_PENDING) {
            _push(_promise.fulfillReactions, fulfillReaction);
            _push(_promise.rejectReactions, rejectReaction);
          } else if (_promise.state === PROMISE_FULFILLED) {
            value = _promise.result;
            enqueue(function() {
              promiseReactionJob(fulfillReaction, value);
            });
          } else if (_promise.state === PROMISE_REJECTED) {
            value = _promise.result;
            enqueue(function() {
              promiseReactionJob(rejectReaction, value);
            });
          } else {
            throw new TypeError('unexpected Promise state');
          }
          return resultCapability.promise;
        }
      });
      return Promise;
    }());
    if (globals.Promise) {
      delete globals.Promise.accept;
      delete globals.Promise.defer;
      delete globals.Promise.prototype.chain;
    }
    if (typeof PromiseShim === 'function') {
      defineProperties(globals, {Promise: PromiseShim});
      var promiseSupportsSubclassing = supportsSubclassing(globals.Promise, function(S) {
        return S.resolve(42).then(function() {}) instanceof S;
      });
      var promiseIgnoresNonFunctionThenCallbacks = !throwsError(function() {
        globals.Promise.reject(42).then(null, 5).then(null, noop);
      });
      var promiseRequiresObjectContext = throwsError(function() {
        globals.Promise.call(3, noop);
      });
      var promiseResolveBroken = (function(Promise) {
        var p = Promise.resolve(5);
        p.constructor = {};
        var p2 = Promise.resolve(p);
        return (p === p2);
      }(globals.Promise));
      if (!promiseSupportsSubclassing || !promiseIgnoresNonFunctionThenCallbacks || !promiseRequiresObjectContext || promiseResolveBroken) {
        Promise = PromiseShim;
        overrideNative(globals, 'Promise', PromiseShim);
      }
      addDefaultSpecies(Promise);
    }
    var testOrder = function(a) {
      var b = Object.keys(_reduce(a, function(o, k) {
        o[k] = true;
        return o;
      }, {}));
      return a.join(':') === b.join(':');
    };
    var preservesInsertionOrder = testOrder(['z', 'a', 'bb']);
    var preservesNumericInsertionOrder = testOrder(['z', 1, 'a', '3', 2]);
    if (supportsDescriptors) {
      var fastkey = function fastkey(key) {
        if (!preservesInsertionOrder) {
          return null;
        }
        var type = typeof key;
        if (type === 'undefined' || key === null) {
          return '^' + String(key);
        } else if (type === 'string') {
          return '$' + key;
        } else if (type === 'number') {
          if (!preservesNumericInsertionOrder) {
            return 'n' + key;
          }
          return key;
        } else if (type === 'boolean') {
          return 'b' + key;
        }
        return null;
      };
      var emptyObject = function emptyObject() {
        return Object.create ? Object.create(null) : {};
      };
      var addIterableToMap = function addIterableToMap(MapConstructor, map, iterable) {
        if (isArray(iterable) || Type.string(iterable)) {
          _forEach(iterable, function(entry) {
            map.set(entry[0], entry[1]);
          });
        } else if (iterable instanceof MapConstructor) {
          _call(MapConstructor.prototype.forEach, iterable, function(value, key) {
            map.set(key, value);
          });
        } else {
          var iter,
              adder;
          if (iterable !== null && typeof iterable !== 'undefined') {
            adder = map.set;
            if (!ES.IsCallable(adder)) {
              throw new TypeError('bad map');
            }
            iter = ES.GetIterator(iterable);
          }
          if (typeof iter !== 'undefined') {
            while (true) {
              var next = ES.IteratorStep(iter);
              if (next === false) {
                break;
              }
              var nextItem = next.value;
              try {
                if (!ES.TypeIsObject(nextItem)) {
                  throw new TypeError('expected iterable of pairs');
                }
                _call(adder, map, nextItem[0], nextItem[1]);
              } catch (e) {
                ES.IteratorClose(iter, true);
                throw e;
              }
            }
          }
        }
      };
      var addIterableToSet = function addIterableToSet(SetConstructor, set, iterable) {
        if (isArray(iterable) || Type.string(iterable)) {
          _forEach(iterable, function(value) {
            set.add(value);
          });
        } else if (iterable instanceof SetConstructor) {
          _call(SetConstructor.prototype.forEach, iterable, function(value) {
            set.add(value);
          });
        } else {
          var iter,
              adder;
          if (iterable !== null && typeof iterable !== 'undefined') {
            adder = set.add;
            if (!ES.IsCallable(adder)) {
              throw new TypeError('bad set');
            }
            iter = ES.GetIterator(iterable);
          }
          if (typeof iter !== 'undefined') {
            while (true) {
              var next = ES.IteratorStep(iter);
              if (next === false) {
                break;
              }
              var nextValue = next.value;
              try {
                _call(adder, set, nextValue);
              } catch (e) {
                ES.IteratorClose(iter, true);
                throw e;
              }
            }
          }
        }
      };
      var collectionShims = {
        Map: (function() {
          var empty = {};
          var MapEntry = function MapEntry(key, value) {
            this.key = key;
            this.value = value;
            this.next = null;
            this.prev = null;
          };
          MapEntry.prototype.isRemoved = function isRemoved() {
            return this.key === empty;
          };
          var isMap = function isMap(map) {
            return !!map._es6map;
          };
          var requireMapSlot = function requireMapSlot(map, method) {
            if (!ES.TypeIsObject(map) || !isMap(map)) {
              throw new TypeError('Method Map.prototype.' + method + ' called on incompatible receiver ' + String(map));
            }
          };
          var MapIterator = function MapIterator(map, kind) {
            requireMapSlot(map, '[[MapIterator]]');
            this.head = map._head;
            this.i = this.head;
            this.kind = kind;
          };
          MapIterator.prototype = {next: function next() {
              var i = this.i,
                  kind = this.kind,
                  head = this.head,
                  result;
              if (typeof this.i === 'undefined') {
                return {
                  value: void 0,
                  done: true
                };
              }
              while (i.isRemoved() && i !== head) {
                i = i.prev;
              }
              while (i.next !== head) {
                i = i.next;
                if (!i.isRemoved()) {
                  if (kind === 'key') {
                    result = i.key;
                  } else if (kind === 'value') {
                    result = i.value;
                  } else {
                    result = [i.key, i.value];
                  }
                  this.i = i;
                  return {
                    value: result,
                    done: false
                  };
                }
              }
              this.i = void 0;
              return {
                value: void 0,
                done: true
              };
            }};
          addIterator(MapIterator.prototype);
          var Map$prototype;
          var MapShim = function Map() {
            if (!(this instanceof Map)) {
              throw new TypeError('Constructor Map requires "new"');
            }
            if (this && this._es6map) {
              throw new TypeError('Bad construction');
            }
            var map = emulateES6construct(this, Map, Map$prototype, {
              _es6map: true,
              _head: null,
              _storage: emptyObject(),
              _size: 0
            });
            var head = new MapEntry(null, null);
            head.next = head.prev = head;
            map._head = head;
            if (arguments.length > 0) {
              addIterableToMap(Map, map, arguments[0]);
            }
            return map;
          };
          Map$prototype = MapShim.prototype;
          Value.getter(Map$prototype, 'size', function() {
            if (typeof this._size === 'undefined') {
              throw new TypeError('size method called on incompatible Map');
            }
            return this._size;
          });
          defineProperties(Map$prototype, {
            get: function get(key) {
              requireMapSlot(this, 'get');
              var fkey = fastkey(key);
              if (fkey !== null) {
                var entry = this._storage[fkey];
                if (entry) {
                  return entry.value;
                } else {
                  return;
                }
              }
              var head = this._head,
                  i = head;
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  return i.value;
                }
              }
            },
            has: function has(key) {
              requireMapSlot(this, 'has');
              var fkey = fastkey(key);
              if (fkey !== null) {
                return typeof this._storage[fkey] !== 'undefined';
              }
              var head = this._head,
                  i = head;
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  return true;
                }
              }
              return false;
            },
            set: function set(key, value) {
              requireMapSlot(this, 'set');
              var head = this._head,
                  i = head,
                  entry;
              var fkey = fastkey(key);
              if (fkey !== null) {
                if (typeof this._storage[fkey] !== 'undefined') {
                  this._storage[fkey].value = value;
                  return this;
                } else {
                  entry = this._storage[fkey] = new MapEntry(key, value);
                  i = head.prev;
                }
              }
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  i.value = value;
                  return this;
                }
              }
              entry = entry || new MapEntry(key, value);
              if (ES.SameValue(-0, key)) {
                entry.key = +0;
              }
              entry.next = this._head;
              entry.prev = this._head.prev;
              entry.prev.next = entry;
              entry.next.prev = entry;
              this._size += 1;
              return this;
            },
            'delete': function(key) {
              requireMapSlot(this, 'delete');
              var head = this._head,
                  i = head;
              var fkey = fastkey(key);
              if (fkey !== null) {
                if (typeof this._storage[fkey] === 'undefined') {
                  return false;
                }
                i = this._storage[fkey].prev;
                delete this._storage[fkey];
              }
              while ((i = i.next) !== head) {
                if (ES.SameValueZero(i.key, key)) {
                  i.key = i.value = empty;
                  i.prev.next = i.next;
                  i.next.prev = i.prev;
                  this._size -= 1;
                  return true;
                }
              }
              return false;
            },
            clear: function clear() {
              requireMapSlot(this, 'clear');
              this._size = 0;
              this._storage = emptyObject();
              var head = this._head,
                  i = head,
                  p = i.next;
              while ((i = p) !== head) {
                i.key = i.value = empty;
                p = i.next;
                i.next = i.prev = head;
              }
              head.next = head.prev = head;
            },
            keys: function keys() {
              requireMapSlot(this, 'keys');
              return new MapIterator(this, 'key');
            },
            values: function values() {
              requireMapSlot(this, 'values');
              return new MapIterator(this, 'value');
            },
            entries: function entries() {
              requireMapSlot(this, 'entries');
              return new MapIterator(this, 'key+value');
            },
            forEach: function forEach(callback) {
              requireMapSlot(this, 'forEach');
              var context = arguments.length > 1 ? arguments[1] : null;
              var it = this.entries();
              for (var entry = it.next(); !entry.done; entry = it.next()) {
                if (context) {
                  _call(callback, context, entry.value[1], entry.value[0], this);
                } else {
                  callback(entry.value[1], entry.value[0], this);
                }
              }
            }
          });
          addIterator(Map$prototype, Map$prototype.entries);
          return MapShim;
        }()),
        Set: (function() {
          var isSet = function isSet(set) {
            return set._es6set && typeof set._storage !== 'undefined';
          };
          var requireSetSlot = function requireSetSlot(set, method) {
            if (!ES.TypeIsObject(set) || !isSet(set)) {
              throw new TypeError('Set.prototype.' + method + ' called on incompatible receiver ' + String(set));
            }
          };
          var Set$prototype;
          var SetShim = function Set() {
            if (!(this instanceof Set)) {
              throw new TypeError('Constructor Set requires "new"');
            }
            if (this && this._es6set) {
              throw new TypeError('Bad construction');
            }
            var set = emulateES6construct(this, Set, Set$prototype, {
              _es6set: true,
              '[[SetData]]': null,
              _storage: emptyObject()
            });
            if (!set._es6set) {
              throw new TypeError('bad set');
            }
            if (arguments.length > 0) {
              addIterableToSet(Set, set, arguments[0]);
            }
            return set;
          };
          Set$prototype = SetShim.prototype;
          var ensureMap = function ensureMap(set) {
            if (!set['[[SetData]]']) {
              var m = set['[[SetData]]'] = new collectionShims.Map();
              _forEach(Object.keys(set._storage), function(key) {
                var k = key;
                if (k === '^null') {
                  k = null;
                } else if (k === '^undefined') {
                  k = void 0;
                } else {
                  var first = k.charAt(0);
                  if (first === '$') {
                    k = _strSlice(k, 1);
                  } else if (first === 'n') {
                    k = +_strSlice(k, 1);
                  } else if (first === 'b') {
                    k = k === 'btrue';
                  } else {
                    k = +k;
                  }
                }
                m.set(k, k);
              });
              set._storage = null;
            }
          };
          Value.getter(SetShim.prototype, 'size', function() {
            requireSetSlot(this, 'size');
            ensureMap(this);
            return this['[[SetData]]'].size;
          });
          defineProperties(SetShim.prototype, {
            has: function has(key) {
              requireSetSlot(this, 'has');
              var fkey;
              if (this._storage && (fkey = fastkey(key)) !== null) {
                return !!this._storage[fkey];
              }
              ensureMap(this);
              return this['[[SetData]]'].has(key);
            },
            add: function add(key) {
              requireSetSlot(this, 'add');
              var fkey;
              if (this._storage && (fkey = fastkey(key)) !== null) {
                this._storage[fkey] = true;
                return this;
              }
              ensureMap(this);
              this['[[SetData]]'].set(key, key);
              return this;
            },
            'delete': function(key) {
              requireSetSlot(this, 'delete');
              var fkey;
              if (this._storage && (fkey = fastkey(key)) !== null) {
                var hasFKey = _hasOwnProperty(this._storage, fkey);
                return (delete this._storage[fkey]) && hasFKey;
              }
              ensureMap(this);
              return this['[[SetData]]']['delete'](key);
            },
            clear: function clear() {
              requireSetSlot(this, 'clear');
              if (this._storage) {
                this._storage = emptyObject();
              } else {
                this['[[SetData]]'].clear();
              }
            },
            values: function values() {
              requireSetSlot(this, 'values');
              ensureMap(this);
              return this['[[SetData]]'].values();
            },
            entries: function entries() {
              requireSetSlot(this, 'entries');
              ensureMap(this);
              return this['[[SetData]]'].entries();
            },
            forEach: function forEach(callback) {
              requireSetSlot(this, 'forEach');
              var context = arguments.length > 1 ? arguments[1] : null;
              var entireSet = this;
              ensureMap(entireSet);
              this['[[SetData]]'].forEach(function(value, key) {
                if (context) {
                  _call(callback, context, key, key, entireSet);
                } else {
                  callback(key, key, entireSet);
                }
              });
            }
          });
          defineProperty(SetShim.prototype, 'keys', SetShim.prototype.values, true);
          addIterator(SetShim.prototype, SetShim.prototype.values);
          return SetShim;
        }())
      };
      if (globals.Map || globals.Set) {
        var mapAcceptsArguments = valueOrFalseIfThrows(function() {
          return new Map([[1, 2]]).get(1) === 2;
        });
        if (!mapAcceptsArguments) {
          var OrigMapNoArgs = globals.Map;
          globals.Map = function Map() {
            if (!(this instanceof Map)) {
              throw new TypeError('Constructor Map requires "new"');
            }
            var m = new OrigMapNoArgs();
            if (arguments.length > 0) {
              addIterableToMap(Map, m, arguments[0]);
            }
            Object.setPrototypeOf(m, globals.Map.prototype);
            defineProperty(m, 'constructor', Map, true);
            return m;
          };
          globals.Map.prototype = create(OrigMapNoArgs.prototype);
          Value.preserveToString(globals.Map, OrigMapNoArgs);
        }
        var testMap = new Map();
        var mapUsesSameValueZero = (function(m) {
          m['delete'](0);
          m['delete'](-0);
          m.set(0, 3);
          m.get(-0, 4);
          return m.get(0) === 3 && m.get(-0) === 4;
        }(testMap));
        var mapSupportsChaining = testMap.set(1, 2) === testMap;
        if (!mapUsesSameValueZero || !mapSupportsChaining) {
          var origMapSet = Map.prototype.set;
          overrideNative(Map.prototype, 'set', function set(k, v) {
            _call(origMapSet, this, k === 0 ? 0 : k, v);
            return this;
          });
        }
        if (!mapUsesSameValueZero) {
          var origMapGet = Map.prototype.get;
          var origMapHas = Map.prototype.has;
          defineProperties(Map.prototype, {
            get: function get(k) {
              return _call(origMapGet, this, k === 0 ? 0 : k);
            },
            has: function has(k) {
              return _call(origMapHas, this, k === 0 ? 0 : k);
            }
          }, true);
          Value.preserveToString(Map.prototype.get, origMapGet);
          Value.preserveToString(Map.prototype.has, origMapHas);
        }
        var testSet = new Set();
        var setUsesSameValueZero = (function(s) {
          s['delete'](0);
          s.add(-0);
          return !s.has(0);
        }(testSet));
        var setSupportsChaining = testSet.add(1) === testSet;
        if (!setUsesSameValueZero || !setSupportsChaining) {
          var origSetAdd = Set.prototype.add;
          Set.prototype.add = function add(v) {
            _call(origSetAdd, this, v === 0 ? 0 : v);
            return this;
          };
          Value.preserveToString(Set.prototype.add, origSetAdd);
        }
        if (!setUsesSameValueZero) {
          var origSetHas = Set.prototype.has;
          Set.prototype.has = function has(v) {
            return _call(origSetHas, this, v === 0 ? 0 : v);
          };
          Value.preserveToString(Set.prototype.has, origSetHas);
          var origSetDel = Set.prototype['delete'];
          Set.prototype['delete'] = function SetDelete(v) {
            return _call(origSetDel, this, v === 0 ? 0 : v);
          };
          Value.preserveToString(Set.prototype['delete'], origSetDel);
        }
        var mapSupportsSubclassing = supportsSubclassing(globals.Map, function(M) {
          var m = new M([]);
          m.set(42, 42);
          return m instanceof M;
        });
        var mapFailsToSupportSubclassing = Object.setPrototypeOf && !mapSupportsSubclassing;
        var mapRequiresNew = (function() {
          try {
            return !(globals.Map() instanceof globals.Map);
          } catch (e) {
            return e instanceof TypeError;
          }
        }());
        if (globals.Map.length !== 0 || mapFailsToSupportSubclassing || !mapRequiresNew) {
          var OrigMap = globals.Map;
          globals.Map = function Map() {
            if (!(this instanceof Map)) {
              throw new TypeError('Constructor Map requires "new"');
            }
            var m = new OrigMap();
            if (arguments.length > 0) {
              addIterableToMap(Map, m, arguments[0]);
            }
            Object.setPrototypeOf(m, Map.prototype);
            defineProperty(m, 'constructor', Map, true);
            return m;
          };
          globals.Map.prototype = OrigMap.prototype;
          Value.preserveToString(globals.Map, OrigMap);
        }
        var setSupportsSubclassing = supportsSubclassing(globals.Set, function(S) {
          var s = new S([]);
          s.add(42, 42);
          return s instanceof S;
        });
        var setFailsToSupportSubclassing = Object.setPrototypeOf && !setSupportsSubclassing;
        var setRequiresNew = (function() {
          try {
            return !(globals.Set() instanceof globals.Set);
          } catch (e) {
            return e instanceof TypeError;
          }
        }());
        if (globals.Set.length !== 0 || setFailsToSupportSubclassing || !setRequiresNew) {
          var OrigSet = globals.Set;
          globals.Set = function Set() {
            if (!(this instanceof Set)) {
              throw new TypeError('Constructor Set requires "new"');
            }
            var s = new OrigSet();
            if (arguments.length > 0) {
              addIterableToSet(Set, s, arguments[0]);
            }
            Object.setPrototypeOf(s, Set.prototype);
            defineProperty(s, 'constructor', Set, true);
            return s;
          };
          globals.Set.prototype = OrigSet.prototype;
          Value.preserveToString(globals.Set, OrigSet);
        }
        var mapIterationThrowsStopIterator = !valueOrFalseIfThrows(function() {
          return (new Map()).keys().next().done;
        });
        if (typeof globals.Map.prototype.clear !== 'function' || new globals.Set().size !== 0 || new globals.Map().size !== 0 || typeof globals.Map.prototype.keys !== 'function' || typeof globals.Set.prototype.keys !== 'function' || typeof globals.Map.prototype.forEach !== 'function' || typeof globals.Set.prototype.forEach !== 'function' || isCallableWithoutNew(globals.Map) || isCallableWithoutNew(globals.Set) || typeof(new globals.Map().keys().next) !== 'function' || mapIterationThrowsStopIterator || !mapSupportsSubclassing) {
          delete globals.Map;
          delete globals.Set;
          defineProperties(globals, {
            Map: collectionShims.Map,
            Set: collectionShims.Set
          }, true);
        }
        if (globals.Set.prototype.keys !== globals.Set.prototype.values) {
          defineProperty(globals.Set.prototype, 'keys', globals.Set.prototype.values, true);
        }
        addIterator(Object.getPrototypeOf((new globals.Map()).keys()));
        addIterator(Object.getPrototypeOf((new globals.Set()).keys()));
        if (functionsHaveNames && globals.Set.prototype.has.name !== 'has') {
          var anonymousSetHas = globals.Set.prototype.has;
          overrideNative(globals.Set.prototype, 'has', function has(key) {
            return _call(anonymousSetHas, this, key);
          });
        }
      }
      defineProperties(globals, collectionShims);
      addDefaultSpecies(globals.Map);
      addDefaultSpecies(globals.Set);
    }
    var throwUnlessTargetIsObject = function throwUnlessTargetIsObject(target) {
      if (!ES.TypeIsObject(target)) {
        throw new TypeError('target must be an object');
      }
    };
    var ReflectShims = {
      apply: function apply() {
        return _apply(ES.Call, null, arguments);
      },
      construct: function construct(constructor, args) {
        if (!ES.IsConstructor(constructor)) {
          throw new TypeError('First argument must be a constructor.');
        }
        var newTarget = arguments.length < 3 ? constructor : arguments[2];
        if (!ES.IsConstructor(newTarget)) {
          throw new TypeError('new.target must be a constructor.');
        }
        return ES.Construct(constructor, args, newTarget, 'internal');
      },
      deleteProperty: function deleteProperty(target, key) {
        throwUnlessTargetIsObject(target);
        if (supportsDescriptors) {
          var desc = Object.getOwnPropertyDescriptor(target, key);
          if (desc && !desc.configurable) {
            return false;
          }
        }
        return delete target[key];
      },
      enumerate: function enumerate(target) {
        throwUnlessTargetIsObject(target);
        return new ObjectIterator(target, 'key');
      },
      has: function has(target, key) {
        throwUnlessTargetIsObject(target);
        return key in target;
      }
    };
    if (Object.getOwnPropertyNames) {
      Object.assign(ReflectShims, {ownKeys: function ownKeys(target) {
          throwUnlessTargetIsObject(target);
          var keys = Object.getOwnPropertyNames(target);
          if (ES.IsCallable(Object.getOwnPropertySymbols)) {
            _pushApply(keys, Object.getOwnPropertySymbols(target));
          }
          return keys;
        }});
    }
    var callAndCatchException = function ConvertExceptionToBoolean(func) {
      return !throwsError(func);
    };
    if (Object.preventExtensions) {
      Object.assign(ReflectShims, {
        isExtensible: function isExtensible(target) {
          throwUnlessTargetIsObject(target);
          return Object.isExtensible(target);
        },
        preventExtensions: function preventExtensions(target) {
          throwUnlessTargetIsObject(target);
          return callAndCatchException(function() {
            Object.preventExtensions(target);
          });
        }
      });
    }
    if (supportsDescriptors) {
      var internalGet = function get(target, key, receiver) {
        var desc = Object.getOwnPropertyDescriptor(target, key);
        if (!desc) {
          var parent = Object.getPrototypeOf(target);
          if (parent === null) {
            return undefined;
          }
          return internalGet(parent, key, receiver);
        }
        if ('value' in desc) {
          return desc.value;
        }
        if (desc.get) {
          return _call(desc.get, receiver);
        }
        return undefined;
      };
      var internalSet = function set(target, key, value, receiver) {
        var desc = Object.getOwnPropertyDescriptor(target, key);
        if (!desc) {
          var parent = Object.getPrototypeOf(target);
          if (parent !== null) {
            return internalSet(parent, key, value, receiver);
          }
          desc = {
            value: void 0,
            writable: true,
            enumerable: true,
            configurable: true
          };
        }
        if ('value' in desc) {
          if (!desc.writable) {
            return false;
          }
          if (!ES.TypeIsObject(receiver)) {
            return false;
          }
          var existingDesc = Object.getOwnPropertyDescriptor(receiver, key);
          if (existingDesc) {
            return Reflect.defineProperty(receiver, key, {value: value});
          } else {
            return Reflect.defineProperty(receiver, key, {
              value: value,
              writable: true,
              enumerable: true,
              configurable: true
            });
          }
        }
        if (desc.set) {
          _call(desc.set, receiver, value);
          return true;
        }
        return false;
      };
      Object.assign(ReflectShims, {
        defineProperty: function defineProperty(target, propertyKey, attributes) {
          throwUnlessTargetIsObject(target);
          return callAndCatchException(function() {
            Object.defineProperty(target, propertyKey, attributes);
          });
        },
        getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, propertyKey) {
          throwUnlessTargetIsObject(target);
          return Object.getOwnPropertyDescriptor(target, propertyKey);
        },
        get: function get(target, key) {
          throwUnlessTargetIsObject(target);
          var receiver = arguments.length > 2 ? arguments[2] : target;
          return internalGet(target, key, receiver);
        },
        set: function set(target, key, value) {
          throwUnlessTargetIsObject(target);
          var receiver = arguments.length > 3 ? arguments[3] : target;
          return internalSet(target, key, value, receiver);
        }
      });
    }
    if (Object.getPrototypeOf) {
      var objectDotGetPrototypeOf = Object.getPrototypeOf;
      ReflectShims.getPrototypeOf = function getPrototypeOf(target) {
        throwUnlessTargetIsObject(target);
        return objectDotGetPrototypeOf(target);
      };
    }
    if (Object.setPrototypeOf && ReflectShims.getPrototypeOf) {
      var willCreateCircularPrototype = function(object, lastProto) {
        var proto = lastProto;
        while (proto) {
          if (object === proto) {
            return true;
          }
          proto = ReflectShims.getPrototypeOf(proto);
        }
        return false;
      };
      Object.assign(ReflectShims, {setPrototypeOf: function setPrototypeOf(object, proto) {
          throwUnlessTargetIsObject(object);
          if (proto !== null && !ES.TypeIsObject(proto)) {
            throw new TypeError('proto must be an object or null');
          }
          if (proto === Reflect.getPrototypeOf(object)) {
            return true;
          }
          if (Reflect.isExtensible && !Reflect.isExtensible(object)) {
            return false;
          }
          if (willCreateCircularPrototype(object, proto)) {
            return false;
          }
          Object.setPrototypeOf(object, proto);
          return true;
        }});
    }
    var defineOrOverrideReflectProperty = function(key, shim) {
      if (!ES.IsCallable(globals.Reflect[key])) {
        defineProperty(globals.Reflect, key, shim);
      } else {
        var acceptsPrimitives = valueOrFalseIfThrows(function() {
          globals.Reflect[key](1);
          globals.Reflect[key](NaN);
          globals.Reflect[key](true);
          return true;
        });
        if (acceptsPrimitives) {
          overrideNative(globals.Reflect, key, shim);
        }
      }
    };
    Object.keys(ReflectShims).forEach(function(key) {
      defineOrOverrideReflectProperty(key, ReflectShims[key]);
    });
    if (functionsHaveNames && globals.Reflect.getPrototypeOf.name !== 'getPrototypeOf') {
      var originalReflectGetProto = globals.Reflect.getPrototypeOf;
      overrideNative(globals.Reflect, 'getPrototypeOf', function getPrototypeOf(target) {
        return _call(originalReflectGetProto, globals.Reflect, target);
      });
    }
    if (globals.Reflect.setPrototypeOf) {
      if (valueOrFalseIfThrows(function() {
        globals.Reflect.setPrototypeOf(1, {});
        return true;
      })) {
        overrideNative(globals.Reflect, 'setPrototypeOf', ReflectShims.setPrototypeOf);
      }
    }
    if (globals.Reflect.defineProperty) {
      if (!valueOrFalseIfThrows(function() {
        var basic = !globals.Reflect.defineProperty(1, 'test', {value: 1});
        var extensible = typeof Object.preventExtensions !== 'function' || !globals.Reflect.defineProperty(Object.preventExtensions({}), 'test', {});
        return basic && extensible;
      })) {
        overrideNative(globals.Reflect, 'defineProperty', ReflectShims.defineProperty);
      }
    }
    if (globals.Reflect.construct) {
      if (!valueOrFalseIfThrows(function() {
        var F = function F() {};
        return globals.Reflect.construct(function() {}, [], F) instanceof F;
      })) {
        overrideNative(globals.Reflect, 'construct', ReflectShims.construct);
      }
    }
    if (String(new Date(NaN)) !== 'Invalid Date') {
      var dateToString = Date.prototype.toString;
      var shimmedDateToString = function toString() {
        var valueOf = +this;
        if (valueOf !== valueOf) {
          return 'Invalid Date';
        }
        return _call(dateToString, this);
      };
      overrideNative(Date.prototype, 'toString', shimmedDateToString);
    }
    var stringHTMLshims = {
      anchor: function anchor(name) {
        return ES.CreateHTML(this, 'a', 'name', name);
      },
      big: function big() {
        return ES.CreateHTML(this, 'big', '', '');
      },
      blink: function blink() {
        return ES.CreateHTML(this, 'blink', '', '');
      },
      bold: function bold() {
        return ES.CreateHTML(this, 'b', '', '');
      },
      fixed: function fixed() {
        return ES.CreateHTML(this, 'tt', '', '');
      },
      fontcolor: function fontcolor(color) {
        return ES.CreateHTML(this, 'font', 'color', color);
      },
      fontsize: function fontsize(size) {
        return ES.CreateHTML(this, 'font', 'size', size);
      },
      italics: function italics() {
        return ES.CreateHTML(this, 'i', '', '');
      },
      link: function link(url) {
        return ES.CreateHTML(this, 'a', 'href', url);
      },
      small: function small() {
        return ES.CreateHTML(this, 'small', '', '');
      },
      strike: function strike() {
        return ES.CreateHTML(this, 'strike', '', '');
      },
      sub: function sub() {
        return ES.CreateHTML(this, 'sub', '', '');
      },
      sup: function sub() {
        return ES.CreateHTML(this, 'sup', '', '');
      }
    };
    _forEach(Object.keys(stringHTMLshims), function(key) {
      var method = String.prototype[key];
      var shouldOverwrite = false;
      if (ES.IsCallable(method)) {
        var output = _call(method, '', ' " ');
        var quotesCount = _concat([], output.match(/"/g)).length;
        shouldOverwrite = output !== output.toLowerCase() || quotesCount > 2;
      } else {
        shouldOverwrite = true;
      }
      if (shouldOverwrite) {
        overrideNative(String.prototype, key, stringHTMLshims[key]);
      }
    });
    var JSONstringifiesSymbols = (function() {
      if (!Type.symbol(Symbol.iterator)) {
        return false;
      }
      var stringify = typeof JSON === 'object' && typeof JSON.stringify === 'function' ? JSON.stringify : null;
      if (!stringify) {
        return false;
      }
      if (typeof stringify(Symbol()) !== 'undefined') {
        return true;
      }
      if (stringify([Symbol()]) !== '[null]') {
        return true;
      }
      var obj = {a: Symbol()};
      obj[Symbol()] = true;
      if (stringify(obj) !== '{}') {
        return true;
      }
      return false;
    }());
    var JSONstringifyAcceptsObjectSymbol = valueOrFalseIfThrows(function() {
      if (!Type.symbol(Symbol.iterator)) {
        return true;
      }
      return JSON.stringify(Object(Symbol())) === '{}' && JSON.stringify([Object(Symbol())]) === '[{}]';
    });
    if (JSONstringifiesSymbols || !JSONstringifyAcceptsObjectSymbol) {
      var origStringify = JSON.stringify;
      overrideNative(JSON, 'stringify', function stringify(value) {
        if (typeof value === 'symbol') {
          return;
        }
        var replacer;
        if (arguments.length > 1) {
          replacer = arguments[1];
        }
        var args = [value];
        if (!isArray(replacer)) {
          var replaceFn = ES.IsCallable(replacer) ? replacer : null;
          var wrappedReplacer = function(key, val) {
            var parsedValue = replacer ? _call(replacer, this, key, val) : val;
            if (typeof parsedValue !== 'symbol') {
              if (Type.symbol(parsedValue)) {
                return assignTo({})(parsedValue);
              } else {
                return parsedValue;
              }
            }
          };
          args.push(wrappedReplacer);
        } else {
          args.push(replacer);
        }
        if (arguments.length > 2) {
          args.push(arguments[2]);
        }
        return origStringify.apply(this, args);
      });
    }
    return globals;
  }));
})(require('process'));
