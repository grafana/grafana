;(function() {

  /** Used as a safe reference for `undefined` in pre-ES5 environments. */
  var undefined;

  /** Used to detect when a function becomes hot. */
  var HOT_COUNT = 150;

  /** Used as the size to cover large array optimizations. */
  var LARGE_ARRAY_SIZE = 200;

  /** Used as the `TypeError` message for "Functions" methods. */
  var FUNC_ERROR_TEXT = 'Expected a function';

  /** Used as references for various `Number` constants. */
  var MAX_SAFE_INTEGER = 9007199254740991,
      MAX_INTEGER = 1.7976931348623157e+308;

  /** Used as references for the maximum length and index of an array. */
  var MAX_ARRAY_LENGTH = 4294967295,
      MAX_ARRAY_INDEX = MAX_ARRAY_LENGTH - 1;

  /** `Object#toString` result references. */
  var funcTag = '[object Function]',
      numberTag = '[object Number]',
      objectTag = '[object Object]';

  /** Used as a reference to the global object. */
  var root = (typeof global == 'object' && global) || this;

  /** Used to store lodash to test for bad extensions/shims. */
  var lodashBizarro = root.lodashBizarro;

  /** Used for native method references. */
  var arrayProto = Array.prototype,
      funcProto = Function.prototype,
      objectProto = Object.prototype,
      numberProto = Number.prototype,
      stringProto = String.prototype;

  /** Method and object shortcuts. */
  var phantom = root.phantom,
      process = root.process,
      amd = root.define && define.amd,
      argv = process && process.argv,
      defineProperty = Object.defineProperty,
      document = !phantom && root.document,
      body = root.document && root.document.body,
      create = Object.create,
      fnToString = funcProto.toString,
      freeze = Object.freeze,
      getSymbols = Object.getOwnPropertySymbols,
      identity = function(value) { return value; },
      JSON = root.JSON,
      noop = function() {},
      objToString = objectProto.toString,
      params = argv,
      push = arrayProto.push,
      realm = {},
      slice = arrayProto.slice;

  var ArrayBuffer = root.ArrayBuffer,
      Buffer = root.Buffer,
      Promise = root.Promise,
      Map = root.Map,
      Set = root.Set,
      Symbol = root.Symbol,
      Uint8Array = root.Uint8Array,
      WeakMap = root.WeakMap,
      WeakSet = root.WeakSet;

  var arrayBuffer = ArrayBuffer ? new ArrayBuffer(2) : undefined,
      map = Map ? new Map : undefined,
      promise = Promise ? Promise.resolve(1) : undefined,
      set = Set ? new Set : undefined,
      symbol = Symbol ? Symbol('a') : undefined,
      weakMap = WeakMap ? new WeakMap : undefined,
      weakSet = WeakSet ? new WeakSet : undefined;

  /** Math helpers. */
  var add = function(x, y) { return x + y; },
      doubled = function(n) { return n * 2; },
      isEven = function(n) { return n % 2 == 0; },
      square = function(n) { return n * n; };

  /** Stub functions. */
  var stubA = function() { return 'a'; },
      stubB = function() { return 'b'; },
      stubC = function() { return 'c'; };

  var stubTrue = function() { return true; },
      stubFalse = function() { return false; };

  var stubNaN = function() { return NaN; },
      stubNull = function() { return null; };

  var stubZero = function() { return 0; },
      stubOne = function() { return 1; },
      stubTwo = function() { return 2; },
      stubThree = function() { return 3; },
      stubFour = function() { return 4; };

  var stubArray = function() { return []; },
      stubObject = function() { return {}; },
      stubString = function() { return ''; };



  /** List of Latin Unicode letters. */
  var burredLetters = [
    // Latin-1 Supplement letters.
    '\xc0', '\xc1', '\xc2', '\xc3', '\xc4', '\xc5', '\xc6', '\xc7', '\xc8', '\xc9', '\xca', '\xcb', '\xcc', '\xcd', '\xce', '\xcf',
    '\xd0', '\xd1', '\xd2', '\xd3', '\xd4', '\xd5', '\xd6',         '\xd8', '\xd9', '\xda', '\xdb', '\xdc', '\xdd', '\xde', '\xdf',
    '\xe0', '\xe1', '\xe2', '\xe3', '\xe4', '\xe5', '\xe6', '\xe7', '\xe8', '\xe9', '\xea', '\xeb', '\xec', '\xed', '\xee', '\xef',
    '\xf0', '\xf1', '\xf2', '\xf3', '\xf4', '\xf5', '\xf6',         '\xf8', '\xf9', '\xfa', '\xfb', '\xfc', '\xfd', '\xfe', '\xff',
    // Latin Extended-A letters.
    '\u0100', '\u0101', '\u0102', '\u0103', '\u0104', '\u0105', '\u0106', '\u0107', '\u0108', '\u0109', '\u010a', '\u010b', '\u010c', '\u010d', '\u010e', '\u010f',
    '\u0110', '\u0111', '\u0112', '\u0113', '\u0114', '\u0115', '\u0116', '\u0117', '\u0118', '\u0119', '\u011a', '\u011b', '\u011c', '\u011d', '\u011e', '\u011f',
    '\u0120', '\u0121', '\u0122', '\u0123', '\u0124', '\u0125', '\u0126', '\u0127', '\u0128', '\u0129', '\u012a', '\u012b', '\u012c', '\u012d', '\u012e', '\u012f',
    '\u0130', '\u0131', '\u0132', '\u0133', '\u0134', '\u0135', '\u0136', '\u0137', '\u0138', '\u0139', '\u013a', '\u013b', '\u013c', '\u013d', '\u013e', '\u013f',
    '\u0140', '\u0141', '\u0142', '\u0143', '\u0144', '\u0145', '\u0146', '\u0147', '\u0148', '\u0149', '\u014a', '\u014b', '\u014c', '\u014d', '\u014e', '\u014f',
    '\u0150', '\u0151', '\u0152', '\u0153', '\u0154', '\u0155', '\u0156', '\u0157', '\u0158', '\u0159', '\u015a', '\u015b', '\u015c', '\u015d', '\u015e', '\u015f',
    '\u0160', '\u0161', '\u0162', '\u0163', '\u0164', '\u0165', '\u0166', '\u0167', '\u0168', '\u0169', '\u016a', '\u016b', '\u016c', '\u016d', '\u016e', '\u016f',
    '\u0170', '\u0171', '\u0172', '\u0173', '\u0174', '\u0175', '\u0176', '\u0177', '\u0178', '\u0179', '\u017a', '\u017b', '\u017c', '\u017d', '\u017e', '\u017f'
  ];

  /** List of combining diacritical marks. */
  var comboMarks = [
    '\u0300', '\u0301', '\u0302', '\u0303', '\u0304', '\u0305', '\u0306', '\u0307', '\u0308', '\u0309', '\u030a', '\u030b', '\u030c', '\u030d', '\u030e', '\u030f',
    '\u0310', '\u0311', '\u0312', '\u0313', '\u0314', '\u0315', '\u0316', '\u0317', '\u0318', '\u0319', '\u031a', '\u031b', '\u031c', '\u031d', '\u031e', '\u031f',
    '\u0320', '\u0321', '\u0322', '\u0323', '\u0324', '\u0325', '\u0326', '\u0327', '\u0328', '\u0329', '\u032a', '\u032b', '\u032c', '\u032d', '\u032e', '\u032f',
    '\u0330', '\u0331', '\u0332', '\u0333', '\u0334', '\u0335', '\u0336', '\u0337', '\u0338', '\u0339', '\u033a', '\u033b', '\u033c', '\u033d', '\u033e', '\u033f',
    '\u0340', '\u0341', '\u0342', '\u0343', '\u0344', '\u0345', '\u0346', '\u0347', '\u0348', '\u0349', '\u034a', '\u034b', '\u034c', '\u034d', '\u034e', '\u034f',
    '\u0350', '\u0351', '\u0352', '\u0353', '\u0354', '\u0355', '\u0356', '\u0357', '\u0358', '\u0359', '\u035a', '\u035b', '\u035c', '\u035d', '\u035e', '\u035f',
    '\u0360', '\u0361', '\u0362', '\u0363', '\u0364', '\u0365', '\u0366', '\u0367', '\u0368', '\u0369', '\u036a', '\u036b', '\u036c', '\u036d', '\u036e', '\u036f',
    '\ufe20', '\ufe21', '\ufe22', '\ufe23'
  ];

  /** List of converted Latin Unicode letters. */
  var deburredLetters = [
    // Converted Latin-1 Supplement letters.
    'A',  'A', 'A', 'A', 'A', 'A', 'Ae', 'C',  'E', 'E', 'E', 'E', 'I', 'I', 'I',
    'I',  'D', 'N', 'O', 'O', 'O', 'O',  'O',  'O', 'U', 'U', 'U', 'U', 'Y', 'Th',
    'ss', 'a', 'a', 'a', 'a', 'a', 'a',  'ae', 'c', 'e', 'e', 'e', 'e', 'i', 'i',  'i',
    'i',  'd', 'n', 'o', 'o', 'o', 'o',  'o',  'o', 'u', 'u', 'u', 'u', 'y', 'th', 'y',
    // Converted Latin Extended-A letters.
    'A', 'a', 'A', 'a', 'A', 'a', 'C', 'c', 'C', 'c', 'C', 'c', 'C', 'c',
    'D', 'd', 'D', 'd', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e', 'E', 'e',
    'G', 'g', 'G', 'g', 'G', 'g', 'G', 'g', 'H', 'h', 'H', 'h',
    'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', 'I', 'i', 'IJ', 'ij', 'J', 'j',
    'K', 'k', 'k', 'L', 'l', 'L', 'l', 'L', 'l', 'L', 'l', 'L', 'l',
    'N', 'n', 'N', 'n', 'N', 'n', "'n", 'N', 'n',
    'O', 'o', 'O', 'o', 'O', 'o', 'Oe', 'oe',
    'R', 'r', 'R', 'r', 'R', 'r', 'S', 's', 'S', 's', 'S', 's', 'S', 's',
    'T', 't', 'T', 't', 'T', 't',
    'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u', 'U', 'u',
    'W', 'w', 'Y', 'y', 'Y', 'Z', 'z', 'Z', 'z', 'Z', 'z', 'ss'
  ];

  /** Used to provide falsey values to methods. */
  var falsey = [, null, undefined, false, 0, NaN, ''];

  /** Used to specify the emoji style glyph variant of characters. */
  var emojiVar = '\ufe0f';

  /** Used to provide empty values to methods. */
  var empties = [[], {}].concat(falsey.slice(1));

  /** Used to test error objects. */
  var errors = [
    new Error,
    new EvalError,
    new RangeError,
    new ReferenceError,
    new SyntaxError,
    new TypeError,
    new URIError
  ];

  /** List of fitzpatrick modifiers. */
  var fitzModifiers = [
    '\ud83c\udffb',
    '\ud83c\udffc',
    '\ud83c\udffd',
    '\ud83c\udffe',
    '\ud83c\udfff'
  ];

  /** Used to provide primitive values to methods. */
  var primitives = [null, undefined, false, true, 1, NaN, 'a'];

  /** Used to check whether methods support typed arrays. */
  var typedArrays = [
    'Float32Array',
    'Float64Array',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Uint16Array',
    'Uint32Array'
  ];

  /** Used to check whether methods support array views. */
  var arrayViews = typedArrays.concat('DataView');

  /** The file path of the lodash file to test. */
  var filePath = (function() {
    var min = 2,
        result = params || [];

    if (phantom) {
      min = 0;
      result = params = phantom.args || require('system').args;
    }
    var last = result[result.length - 1];
    result = (result.length > min && !/test(?:\.js)?$/.test(last)) ? last : '../lodash.js';

    if (!amd) {
      try {
        result = require('fs').realpathSync(result);
      } catch (e) {}

      try {
        result = require.resolve(result);
      } catch (e) {}
    }
    return result;
  }());

  /** The `ui` object. */
  var ui = root.ui || (root.ui = {
    'buildPath': filePath,
    'loaderPath': '',
    'isModularize': /\b(?:amd|commonjs|es|node|npm|(index|main)\.js)\b/.test(filePath),
    'isStrict': /\bes\b/.test(filePath) || 'default' in require(filePath),
    'urlParams': {}
  });

  /** The basename of the lodash file to test. */
  var basename = /[\w.-]+$/.exec(filePath)[0];

  /** Used to indicate testing a modularized build. */
  var isModularize = ui.isModularize;

  /** Detect if testing `npm` modules. */
  var isNpm = isModularize && /\bnpm\b/.test([ui.buildPath, ui.urlParams.build]);

  /** Detect if running in PhantomJS. */
  var isPhantom = phantom || (typeof callPhantom == 'function');

  /** Detect if lodash is in strict mode. */
  var isStrict = ui.isStrict;

  /*--------------------------------------------------------------------------*/

  // Leak to avoid sporadic `noglobals` fails on Edge in Sauce Labs.
  root.msWDfn = undefined;

  // Assign `setTimeout` to itself to avoid being flagged as a leak.
  setProperty(root, 'setTimeout', setTimeout);

  // Exit early if going to run tests in a PhantomJS web page.
  if (phantom && isModularize) {
    var page = require('webpage').create();

    page.onCallback = function(details) {
      var coverage = details.coverage;
      if (coverage) {
        var fs = require('fs'),
            cwd = fs.workingDirectory,
            sep = fs.separator;

        fs.write([cwd, 'coverage', 'coverage.json'].join(sep), JSON.stringify(coverage));
      }
      phantom.exit(details.failed ? 1 : 0);
    };

    page.onConsoleMessage = function(message) {
      console.log(message);
    };

    page.onInitialized = function() {
      page.evaluate(function() {
        document.addEventListener('DOMContentLoaded', function() {
          QUnit.done(function(details) {
            details.coverage = window.__coverage__;
            callPhantom(details);
          });
        });
      });
    };

    page.open(filePath, function(status) {
      if (status != 'success') {
        console.log('PhantomJS failed to load page: ' + filePath);
        phantom.exit(1);
      }
    });

    console.log('test.js invoked with arguments: ' + JSON.stringify(slice.call(params)));
    return;
  }

  /*--------------------------------------------------------------------------*/

  /** Used to test Web Workers. */
  var Worker = !(ui.isForeign || ui.isSauceLabs || isModularize) &&
    (document && document.origin != 'null') && root.Worker;

  /** Used to test host objects in IE. */
  try {
    var xml = new ActiveXObject('Microsoft.XMLDOM');
  } catch (e) {}

  /** Poison the free variable `root` in Node.js */
  try {
    defineProperty(global.root, 'root', {
      'configurable': false,
      'enumerable': false,
      'get': function() { throw new ReferenceError; }
    });
  } catch (e) {}

  /** Load QUnit and extras. */
  var QUnit = root.QUnit || require('qunit-extras');

  /** Load stable Lodash. */
  var lodashStable = root.lodashStable;
  if (!lodashStable) {
    try {
      lodashStable = interopRequire('../node_modules/lodash/lodash.js');
    } catch (e) {
      console.log('Error: The stable lodash dev dependency should be at least a version behind master branch.');
      return;
    }
    lodashStable = lodashStable.noConflict();
  }

  /** The `lodash` function to test. */
  var _ = root._ || (root._ = interopRequire(filePath));

  /** Used to test pseudo private map caches. */
  var mapCaches = (function() {
    var MapCache = _.memoize.Cache;
    var result = {
      'Hash': new MapCache().__data__.hash.constructor,
      'MapCache': MapCache
    };
    _.isMatchWith({ 'a': 1 }, { 'a': 1 }, function() {
      var stack = lodashStable.last(arguments);
      result.ListCache = stack.__data__.constructor;
      result.Stack = stack.constructor;
    });
    return result;
  }());

  /** Used to detect instrumented istanbul code coverage runs. */
  var coverage = root.__coverage__ || root[lodashStable.find(lodashStable.keys(root), function(key) {
    return /^(?:\$\$cov_\d+\$\$)$/.test(key);
  })];

  /** Used to test generator functions. */
  var generator = lodashStable.attempt(function() {
    return Function('return function*(){}');
  });

  /** Used to restore the `_` reference. */
  var oldDash = root._;

  /**
   * Used to check for problems removing whitespace. For a whitespace reference,
   * see [V8's unit test](https://code.google.com/p/v8/source/browse/branches/bleeding_edge/test/mjsunit/whitespaces.js).
   */
  var whitespace = lodashStable.filter([
    // Basic whitespace characters.
    ' ', '\t', '\x0b', '\f', '\xa0', '\ufeff',

    // Line terminators.
    '\n', '\r', '\u2028', '\u2029',

    // Unicode category "Zs" space separators.
    '\u1680', '\u180e', '\u2000', '\u2001', '\u2002', '\u2003', '\u2004', '\u2005',
    '\u2006', '\u2007', '\u2008', '\u2009', '\u200a', '\u202f', '\u205f', '\u3000'
  ],
  function(chr) { return /\s/.exec(chr); })
  .join('');

  /**
   * Creates a custom error object.
   *
   * @private
   * @constructor
   * @param {string} message The error message.
   */
  function CustomError(message) {
    this.name = 'CustomError';
    this.message = message;
  }

  CustomError.prototype = lodashStable.create(Error.prototype, {
    'constructor': CustomError
  });

  /**
   * Removes all own enumerable string keyed properties from a given object.
   *
   * @private
   * @param {Object} object The object to empty.
   */
  function emptyObject(object) {
    lodashStable.forOwn(object, function(value, key, object) {
      delete object[key];
    });
  }

  /**
   * Extracts the unwrapped value from its wrapper.
   *
   * @private
   * @param {Object} wrapper The wrapper to unwrap.
   * @returns {*} Returns the unwrapped value.
   */
  function getUnwrappedValue(wrapper) {
    var index = -1,
        actions = wrapper.__actions__,
        length = actions.length,
        result = wrapper.__wrapped__;

    while (++index < length) {
      var args = [result],
          action = actions[index];

      push.apply(args, action.args);
      result = action.func.apply(action.thisArg, args);
    }
    return result;
  }

  /**
   * Loads the module of `id`. If the module has an `exports.default`, the
   * exported default value is returned as the resolved module.
   *
   * @private
   * @param {string} id The identifier of the module to resolve.
   * @returns {*} Returns the resolved module.
   */
  function interopRequire(id) {
    var result = require(id);
    return 'default' in result ? result['default'] : result;
  }

  /**
   * Sets a non-enumerable property value on `object`.
   *
   * Note: This function is used to avoid a bug in older versions of V8 where
   * overwriting non-enumerable built-ins makes them enumerable.
   * See https://code.google.com/p/v8/issues/detail?id=1623
   *
   * @private
   * @param {Object} object The object modify.
   * @param {string} key The name of the property to set.
   * @param {*} value The property value.
   */
  function setProperty(object, key, value) {
    try {
      defineProperty(object, key, {
        'configurable': true,
        'enumerable': false,
        'writable': true,
        'value': value
      });
    } catch (e) {
      object[key] = value;
    }
    return object;
  }

  /**
   * Skips a given number of tests with a passing result.
   *
   * @private
   * @param {Object} assert The QUnit assert object.
   * @param {number} [count=1] The number of tests to skip.
   */
  function skipAssert(assert, count) {
    count || (count = 1);
    while (count--) {
      assert.ok(true, 'test skipped');
    }
  }

  /*--------------------------------------------------------------------------*/

  // Add bizarro values.
  (function() {
    if (document || (typeof require != 'function')) {
      return;
    }
    var nativeString = fnToString.call(toString),
        reToString = /toString/g;

    function createToString(funcName) {
      return lodashStable.constant(nativeString.replace(reToString, funcName));
    }

    // Allow bypassing native checks.
    setProperty(funcProto, 'toString', function wrapper() {
      setProperty(funcProto, 'toString', fnToString);
      var result = lodashStable.has(this, 'toString') ? this.toString() : fnToString.call(this);
      setProperty(funcProto, 'toString', wrapper);
      return result;
    });

    // Add prototype extensions.
    funcProto._method = noop;

    // Set bad shims.
    setProperty(Object, 'create', (function() {
      function object() {}
      return function(prototype) {
        if (lodashStable.isObject(prototype)) {
          object.prototype = prototype;
          var result = new object;
          object.prototype = undefined;
        }
        return result || {};
      };
    }()));

    setProperty(Object, 'getOwnPropertySymbols', undefined);

    var _propertyIsEnumerable = objectProto.propertyIsEnumerable;
    setProperty(objectProto, 'propertyIsEnumerable', function(key) {
      return !(key == 'valueOf' && this && this.valueOf === 1) && _propertyIsEnumerable.call(this, key);
    });

    if (Buffer) {
      defineProperty(root, 'Buffer', {
        'configurable': true,
        'enumerable': true,
        'get': function get() {
          var caller = get.caller,
              name = caller ? caller.name : '';

          if (!(name == 'runInContext' || name.length == 1 || /\b_\.isBuffer\b/.test(caller))) {
            return Buffer;
          }
        }
      });
    }
    if (Map) {
      setProperty(root, 'Map', (function() {
        var count = 0;
        return function() {
          if (count++) {
            return new Map;
          }
          setProperty(root, 'Map', Map);
          return {};
        };
      }()));

      setProperty(root.Map, 'toString', createToString('Map'));
    }
    setProperty(root, 'Promise', noop);
    setProperty(root, 'Set', noop);
    setProperty(root, 'Symbol', undefined);
    setProperty(root, 'WeakMap', noop);

    // Fake `WinRTError`.
    setProperty(root, 'WinRTError', Error);

    // Clear cache so lodash can be reloaded.
    emptyObject(require.cache);

    // Load lodash and expose it to the bad extensions/shims.
    lodashBizarro = interopRequire(filePath);
    root._ = oldDash;

    // Restore built-in methods.
    setProperty(Object, 'create', create);
    setProperty(objectProto, 'propertyIsEnumerable', _propertyIsEnumerable);
    setProperty(root, 'Buffer', Buffer);

    if (getSymbols) {
      Object.getOwnPropertySymbols = getSymbols;
    } else {
      delete Object.getOwnPropertySymbols;
    }
    if (Map) {
      setProperty(root, 'Map', Map);
    } else {
      delete root.Map;
    }
    if (Promise) {
      setProperty(root, 'Promise', Promise);
    } else {
      delete root.Promise;
    }
    if (Set) {
      setProperty(root, 'Set', Set);
    } else {
      delete root.Set;
    }
    if (Symbol) {
      setProperty(root, 'Symbol', Symbol);
    } else {
      delete root.Symbol;
    }
    if (WeakMap) {
      setProperty(root, 'WeakMap', WeakMap);
    } else {
      delete root.WeakMap;
    }
    delete root.WinRTError;
    delete funcProto._method;
  }());

  // Add other realm values from the `vm` module.
  lodashStable.attempt(function() {
    lodashStable.assign(realm, require('vm').runInNewContext([
      '(function() {',
      '  var noop = function() {},',
      '      root = this;',
      '',
      '  var object = {',
      "    'ArrayBuffer': root.ArrayBuffer,",
      "    'arguments': (function() { return arguments; }(1, 2, 3)),",
      "    'array': [1],",
      "    'arrayBuffer': root.ArrayBuffer ? new root.ArrayBuffer : undefined,",
      "    'boolean': Object(false),",
      "    'date': new Date,",
      "    'errors': [new Error, new EvalError, new RangeError, new ReferenceError, new SyntaxError, new TypeError, new URIError],",
      "    'function': noop,",
      "    'map': root.Map ? new root.Map : undefined,",
      "    'nan': NaN,",
      "    'null': null,",
      "    'number': Object(0),",
      "    'object': { 'a': 1 },",
      "    'promise': root.Promise ? Promise.resolve(1) : undefined,",
      "    'regexp': /x/,",
      "    'set': root.Set ? new root.Set : undefined,",
      "    'string': Object('a'),",
      "    'symbol': root.Symbol ? root.Symbol() : undefined,",
      "    'undefined': undefined,",
      "    'weakMap': root.WeakMap ? new root.WeakMap : undefined,",
      "    'weakSet': root.WeakSet ? new root.WeakSet : undefined",
      '  };',
      '',
      "  ['" + arrayViews.join("', '") + "'].forEach(function(type) {",
      '    var Ctor = root[type]',
      '    object[type] = Ctor;',
      '    object[type.toLowerCase()] = Ctor ? new Ctor(new ArrayBuffer(24)) : undefined;',
      '  });',
      '',
      '  return object;',
      '}())'
    ].join('\n')));
  });

  // Add other realm values from an iframe.
  lodashStable.attempt(function() {
    _._realm = realm;

    var iframe = document.createElement('iframe');
    iframe.frameBorder = iframe.height = iframe.width = 0;
    body.appendChild(iframe);

    var idoc = (idoc = iframe.contentDocument || iframe.contentWindow).document || idoc;
    idoc.write([
      '<script>',
      'var _ = parent._;',
      '',
      '  var noop = function() {},',
      '      root = this;',
      '',
      'var object = {',
      "  'ArrayBuffer': root.ArrayBuffer,",
      "  'arguments': (function() { return arguments; }(1, 2, 3)),",
      "  'array': [1],",
      "  'arrayBuffer': root.ArrayBuffer ? new root.ArrayBuffer : undefined,",
      "  'boolean': Object(false),",
      "  'date': new Date,",
      "  'errors': [new Error, new EvalError, new RangeError, new ReferenceError, new SyntaxError, new TypeError, new URIError],",
      "  'function': noop,",
      "  'map': root.Map ? new root.Map : undefined,",
      "  'nan': NaN,",
      "  'null': null,",
      "  'number': Object(0),",
      "  'object': { 'a': 1 },",
      "  'promise': root.Promise ? Promise.resolve(1) : undefined,",
      "  'regexp': /x/,",
      "  'set': root.Set ? new root.Set : undefined,",
      "  'string': Object('a'),",
      "  'symbol': root.Symbol ? root.Symbol() : undefined,",
      "  'undefined': undefined,",
      "  'weakMap': root.WeakMap ? new root.WeakMap : undefined,",
      "  'weakSet': root.WeakSet ? new root.WeakSet : undefined",
      '};',
      '',
      "_.each(['" + arrayViews.join("', '") + "'], function(type) {",
      '  var Ctor = root[type];',
      '  object[type] = Ctor;',
      '  object[type.toLowerCase()] = Ctor ? new Ctor(new ArrayBuffer(24)) : undefined;',
      '});',
      '',
      '_.assign(_._realm, object);',
      '<\/script>'
    ].join('\n'));

    idoc.close();
    delete _._realm;
  });

  // Add a web worker.
  lodashStable.attempt(function() {
    var worker = new Worker('./asset/worker.js?t=' + (+new Date));
    worker.addEventListener('message', function(e) {
      _._VERSION = e.data || '';
    }, false);

    worker.postMessage(ui.buildPath);
  });

  // Expose internal modules for better code coverage.
  lodashStable.attempt(function() {
    var path = require('path'),
        basePath = path.dirname(filePath);

    if (isModularize && !(amd || isNpm)) {
      lodashStable.each([
        'baseEach',
        'isIndex',
        'isIterateeCall'
      ], function(funcName) {
        _['_' + funcName] = interopRequire(path.join(basePath, '_' + funcName));
      });
    }
  });

  /*--------------------------------------------------------------------------*/

  if (params) {
    console.log('Running lodash tests.');
    console.log('test.js invoked with arguments: ' + JSON.stringify(slice.call(params)));
  }

  QUnit.module(basename);

  (function() {
    QUnit.test('should support loading ' + basename + ' as the "lodash" module', function(assert) {
      assert.expect(1);

      if (amd) {
        assert.strictEqual((lodashModule || {}).moduleName, 'lodash');
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should support loading ' + basename + ' with the Require.js "shim" configuration option', function(assert) {
      assert.expect(1);

      if (amd && lodashStable.includes(ui.loaderPath, 'requirejs')) {
        assert.strictEqual((shimmedModule || {}).moduleName, 'shimmed');
      } else {
        skipAssert(assert);
      }
    });

    QUnit.test('should support loading ' + basename + ' as the "underscore" module', function(assert) {
      assert.expect(1);

      if (amd) {
        assert.strictEqual((underscoreModule || {}).moduleName, 'underscore');
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should support loading ' + basename + ' in a web worker', function(assert) {
      assert.expect(1);

      var done = assert.async();

      if (Worker) {
        var limit = 30000 / QUnit.config.asyncRetries,
            start = +new Date;

        var attempt = function() {
          var actual = _._VERSION;
          if ((new Date - start) < limit && typeof actual != 'string') {
            setTimeout(attempt, 16);
            return;
          }
          assert.strictEqual(actual, _.VERSION);
          done();
        };

        attempt();
      }
      else {
        skipAssert(assert);
        done();
      }
    });

    QUnit.test('should not add `Function.prototype` extensions to lodash', function(assert) {
      assert.expect(1);

      if (lodashBizarro) {
        assert.notOk('_method' in lodashBizarro);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should avoid non-native built-ins', function(assert) {
      assert.expect(7);

      function message(lodashMethod, nativeMethod) {
        return '`' + lodashMethod + '` should avoid overwritten native `' + nativeMethod + '`';
      }

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var object = { 'a': 1 },
          otherObject = { 'b': 2 },
          largeArray = lodashStable.times(LARGE_ARRAY_SIZE, lodashStable.constant(object));

      if (lodashBizarro) {
        try {
          var actual = lodashBizarro.keysIn(new Foo).sort();
        } catch (e) {
          actual = null;
        }
        var label = message('_.keysIn', 'Object#propertyIsEnumerable');
        assert.deepEqual(actual, ['a', 'b'], label);

        try {
          var actual = lodashBizarro.isEmpty({});
        } catch (e) {
          actual = null;
        }
        var label = message('_.isEmpty', 'Object#propertyIsEnumerable');
        assert.strictEqual(actual, true, label);

        try {
          actual = [
            lodashBizarro.difference([object, otherObject], largeArray),
            lodashBizarro.intersection(largeArray, [object]),
            lodashBizarro.uniq(largeArray)
          ];
        } catch (e) {
          actual = null;
        }
        label = message('_.difference`, `_.intersection`, and `_.uniq', 'Object.create` and `Map');
        assert.deepEqual(actual, [[otherObject], [object], [object]], label);

        try {
          if (Symbol) {
            object[symbol] = {};
          }
          actual = [
            lodashBizarro.clone(object),
            lodashBizarro.cloneDeep(object)
          ];
        } catch (e) {
          actual = null;
        }
        label = message('_.clone` and `_.cloneDeep', 'Object.getOwnPropertySymbols');
        assert.deepEqual(actual, [object, object], label);

        try {
          var symObject = Object(symbol);

          // Avoid symbol detection in Babel's `typeof` helper.
          symObject.constructor = Object;

          actual = [
            Symbol ? lodashBizarro.clone(symObject) : { 'constructor': Object },
            Symbol ? lodashBizarro.isEqual(symObject, Object(symbol)) : false,
            Symbol ? lodashBizarro.toString(symObject) : ''
          ];
        } catch (e) {
          actual = null;
        }
        label = message('_.clone`, `_.isEqual`, and `_.toString', 'Symbol');
        assert.deepEqual(actual, [{ 'constructor': Object }, false, ''], label);

        try {
          var map = new lodashBizarro.memoize.Cache;
          actual = map.set('a', 1).get('a');
        } catch (e) {
          actual = null;
        }
        label = message('_.memoize.Cache', 'Map');
        assert.deepEqual(actual, 1, label);

        try {
          map = new (Map || Object);
          if (Symbol && Symbol.iterator) {
            map[Symbol.iterator] = null;
          }
          actual = lodashBizarro.toArray(map);
        } catch (e) {
          actual = null;
        }
        label = message('_.toArray', 'Map');
        assert.deepEqual(actual, [], label);
      }
      else {
        skipAssert(assert, 7);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('isIndex');

  (function() {
    var func = _._isIndex;

    QUnit.test('should return `true` for indexes', function(assert) {
      assert.expect(1);

      if (func) {
        var values = [[0], ['0'], ['1'], [3, 4], [MAX_SAFE_INTEGER - 1]],
            expected = lodashStable.map(values, stubTrue);

        var actual = lodashStable.map(values, function(args) {
          return func.apply(undefined, args);
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non-indexes', function(assert) {
      assert.expect(1);

      if (func) {
        var values = [['1abc'], ['07'], ['0001'], [-1], [3, 3], [1.1], [MAX_SAFE_INTEGER]],
            expected = lodashStable.map(values, stubFalse);

        var actual = lodashStable.map(values, function(args) {
          return func.apply(undefined, args);
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('isIterateeCall');

  (function() {
    var array = [1],
        func = _._isIterateeCall,
        object =  { 'a': 1 };

    QUnit.test('should return `true` for iteratee calls', function(assert) {
      assert.expect(3);

      function Foo() {}
      Foo.prototype.a = 1;

      if (func) {
        assert.strictEqual(func(1, 0, array), true);
        assert.strictEqual(func(1, 'a', object), true);
        assert.strictEqual(func(1, 'a', new Foo), true);
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should return `false` for non-iteratee calls', function(assert) {
      assert.expect(4);

      if (func) {
        assert.strictEqual(func(2, 0, array), false);
        assert.strictEqual(func(1, 1.1, array), false);
        assert.strictEqual(func(1, 0, { 'length': MAX_SAFE_INTEGER + 1 }), false);
        assert.strictEqual(func(1, 'b', object), false);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should work with `NaN` values', function(assert) {
      assert.expect(2);

      if (func) {
        assert.strictEqual(func(NaN, 0, [NaN]), true);
        assert.strictEqual(func(NaN, 'a', { 'a': NaN }), true);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should not error when `index` is an object without a `toString` method', function(assert) {
      assert.expect(1);

      if (func) {
        try {
          var actual = func(1, { 'toString': null }, [1]);
        } catch (e) {
          var message = e.message;
        }
        assert.strictEqual(actual, false, message || '');
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('map caches');

  (function() {
    var keys = [null, undefined, false, true, 1, -Infinity, NaN, {}, 'a', symbol || noop];

    var pairs = lodashStable.map(keys, function(key, index) {
      var lastIndex = keys.length - 1;
      return [key, keys[lastIndex - index]];
    });

    function createCaches(pairs) {
      var largeStack = new mapCaches.Stack(pairs),
          length = pairs ? pairs.length : 0;

      lodashStable.times(LARGE_ARRAY_SIZE - length, function() {
        largeStack.set({}, {});
      });

      return {
        'hashes': new mapCaches.Hash(pairs),
        'list caches': new mapCaches.ListCache(pairs),
        'map caches': new mapCaches.MapCache(pairs),
        'stack caches': new mapCaches.Stack(pairs),
        'large stacks': largeStack
      };
    }

    lodashStable.forOwn(createCaches(pairs), function(cache, kind) {
      QUnit.test('should implement a `Map` interface for ' + kind, function(assert) {
        assert.expect(82);

        lodashStable.each(keys, function(key, index) {
          var value = pairs[index][1];

          assert.deepEqual(cache.get(key), value);
          assert.strictEqual(cache.has(key), true);
          assert.strictEqual(cache['delete'](key), true);
          assert.strictEqual(cache.has(key), false);
          assert.strictEqual(cache.get(key), undefined);
          assert.strictEqual(cache['delete'](key), false);
          assert.strictEqual(cache.set(key, value), cache);
          assert.strictEqual(cache.has(key), true);
        });

        assert.strictEqual(cache.clear(), undefined);
        assert.ok(lodashStable.every(keys, function(key) {
          return !cache.has(key);
        }));
      });
    });

    lodashStable.forOwn(createCaches(), function(cache, kind) {
      QUnit.test('should support changing values of ' + kind, function(assert) {
        assert.expect(10);

        lodashStable.each(keys, function(key) {
          cache.set(key, 1);
          cache.set(key, 2);

          assert.strictEqual(cache.get(key), 2);
        });
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash constructor');

  (function() {
    var values = empties.concat(true, 1, 'a'),
        expected = lodashStable.map(values, stubTrue);

    QUnit.test('should create a new instance when called without the `new` operator', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var actual = lodashStable.map(values, function(value) {
          return _(value) instanceof _;
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return the given `lodash` instances', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var actual = lodashStable.map(values, function(value) {
          var wrapped = _(value);
          return _(wrapped) === wrapped;
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should convert foreign wrapped values to `lodash` instances', function(assert) {
      assert.expect(1);

      if (!isNpm && lodashBizarro) {
        var actual = lodashStable.map(values, function(value) {
          var wrapped = _(lodashBizarro(value)),
              unwrapped = wrapped.value();

          return wrapped instanceof _ &&
            ((unwrapped === value) || (unwrapped !== unwrapped && value !== value));
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.add');

  (function() {
    QUnit.test('should add two numbers', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.add(6, 4), 10);
      assert.strictEqual(_.add(-6, 4), -2);
      assert.strictEqual(_.add(-6, -4), -10);
    });

    QUnit.test('should not coerce arguments to numbers', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.add('6', '4'), '64');
      assert.strictEqual(_.add('x', 'y'), 'xy');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.after');

  (function() {
    function after(n, times) {
      var count = 0;
      lodashStable.times(times, _.after(n, function() { count++; }));
      return count;
    }

    QUnit.test('should create a function that invokes `func` after `n` calls', function(assert) {
      assert.expect(4);

      assert.strictEqual(after(5, 5), 1, 'after(n) should invoke `func` after being called `n` times');
      assert.strictEqual(after(5, 4), 0, 'after(n) should not invoke `func` before being called `n` times');
      assert.strictEqual(after(0, 0), 0, 'after(0) should not invoke `func` immediately');
      assert.strictEqual(after(0, 1), 1, 'after(0) should invoke `func` when called once');
    });

    QUnit.test('should coerce `n` values of `NaN` to `0`', function(assert) {
      assert.expect(1);

      assert.strictEqual(after(NaN, 1), 1);
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(2);

      var after = _.after(1, function(assert) { return ++this.count; }),
          object = { 'after': after, 'count': 0 };

      object.after();
      assert.strictEqual(object.after(), 2);
      assert.strictEqual(object.count, 2);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.ary');

  (function() {
    function fn(a, b, c) {
      return slice.call(arguments);
    }

    QUnit.test('should cap the number of arguments provided to `func`', function(assert) {
      assert.expect(2);

      var actual = lodashStable.map(['6', '8', '10'], _.ary(parseInt, 1));
      assert.deepEqual(actual, [6, 8, 10]);

      var capped = _.ary(fn, 2);
      assert.deepEqual(capped('a', 'b', 'c', 'd'), ['a', 'b']);
    });

    QUnit.test('should use `func.length` if `n` is not given', function(assert) {
      assert.expect(1);

      var capped = _.ary(fn);
      assert.deepEqual(capped('a', 'b', 'c', 'd'), ['a', 'b', 'c']);
    });

    QUnit.test('should treat a negative `n` as `0`', function(assert) {
      assert.expect(1);

      var capped = _.ary(fn, -1);

      try {
        var actual = capped('a');
      } catch (e) {}

      assert.deepEqual(actual, []);
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(1);

      var values = ['1', 1.6, 'xyz'],
          expected = [['a'], ['a'], []];

      var actual = lodashStable.map(values, function(n) {
        var capped = _.ary(fn, n);
        return capped('a', 'b');
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not force a minimum argument count', function(assert) {
      assert.expect(1);

      var capped = _.ary(fn, 3),
          args = ['a', 'b', 'c'];

      var expected = lodashStable.map(args, function(arg, index) {
        return args.slice(0, index);
      });

      var actual = lodashStable.map(expected, function(array) {
        return capped.apply(undefined, array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(1);

      var capped = _.ary(function(a, b) { return this; }, 1),
          object = { 'capped': capped };

      assert.strictEqual(object.capped(), object);
    });

    QUnit.test('should use the existing `ary` if smaller', function(assert) {
      assert.expect(1);

      var capped = _.ary(_.ary(fn, 1), 2);
      assert.deepEqual(capped('a', 'b', 'c'), ['a']);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var funcs = lodashStable.map([fn], _.ary),
          actual = funcs[0]('a', 'b', 'c');

      assert.deepEqual(actual, ['a', 'b', 'c']);
    });

    QUnit.test('should work when combined with other methods that use metadata', function(assert) {
      assert.expect(2);

      var array = ['a', 'b', 'c'],
          includes = _.curry(_.rearg(_.ary(_.includes, 2), 1, 0), 2);

      assert.strictEqual(includes('b')(array, 2), true);

      if (!isNpm) {
        includes = _(_.includes).ary(2).rearg(1, 0).curry(2).value();
        assert.strictEqual(includes('b')(array, 2), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.assignIn');

  (function() {
    QUnit.test('should be aliased', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.extend, _.assignIn);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.assign and lodash.assignIn');

  lodashStable.each(['assign', 'assignIn'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should assign source properties to `object`', function(assert) {
      assert.expect(1);

      assert.deepEqual(func({ 'a': 1 }, { 'b': 2 }), { 'a': 1, 'b': 2 });
    });

    QUnit.test('`_.' + methodName + '` should accept multiple sources', function(assert) {
      assert.expect(2);

      var expected = { 'a': 1, 'b': 2, 'c': 3 };
      assert.deepEqual(func({ 'a': 1 }, { 'b': 2 }, { 'c': 3 }), expected);
      assert.deepEqual(func({ 'a': 1 }, { 'b': 2, 'c': 2 }, { 'c': 3 }), expected);
    });

    QUnit.test('`_.' + methodName + '` should overwrite destination properties', function(assert) {
      assert.expect(1);

      var expected = { 'a': 3, 'b': 2, 'c': 1 };
      assert.deepEqual(func({ 'a': 1, 'b': 2 }, expected), expected);
    });

    QUnit.test('`_.' + methodName + '` should assign source properties with nullish values', function(assert) {
      assert.expect(1);

      var expected = { 'a': null, 'b': undefined, 'c': null };
      assert.deepEqual(func({ 'a': 1, 'b': 2 }, expected), expected);
    });

    QUnit.test('`_.' + methodName + '` should skip assignments if values are the same', function(assert) {
      assert.expect(1);

      var object = {};

      var descriptor = {
        'configurable': true,
        'enumerable': true,
        'set': function() { throw new Error; }
      };

      var source = {
        'a': 1,
        'b': undefined,
        'c': NaN,
        'd': undefined,
        'constructor': Object,
        'toString': lodashStable.constant('source')
      };

      defineProperty(object, 'a', lodashStable.assign({}, descriptor, {
        'get': stubOne
      }));

      defineProperty(object, 'b', lodashStable.assign({}, descriptor, {
        'get': noop
      }));

      defineProperty(object, 'c', lodashStable.assign({}, descriptor, {
        'get': stubNaN
      }));

      defineProperty(object, 'constructor', lodashStable.assign({}, descriptor, {
        'get': lodashStable.constant(Object)
      }));

      try {
        var actual = func(object, source);
      } catch (e) {}

      assert.deepEqual(actual, source);
    });

    QUnit.test('`_.' + methodName + '` should treat sparse array sources as dense', function(assert) {
      assert.expect(1);

      var array = [1];
      array[2] = 3;

      assert.deepEqual(func({}, array), { '0': 1, '1': undefined, '2': 3 });
    });

    QUnit.test('`_.' + methodName + '` should assign values of prototype objects', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.prototype.a = 1;

      assert.deepEqual(func({}, Foo.prototype), { 'a': 1 });
    });

    QUnit.test('`_.' + methodName + '` should coerce string sources to objects', function(assert) {
      assert.expect(1);

      assert.deepEqual(func({}, 'a'), { '0': 'a' });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.assignInWith');

  (function() {
    QUnit.test('should be aliased', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.extendWith, _.assignInWith);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.assignWith and lodash.assignInWith');

  lodashStable.each(['assignWith', 'assignInWith'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should work with a `customizer` callback', function(assert) {
      assert.expect(1);

      var actual = func({ 'a': 1, 'b': 2 }, { 'a': 3, 'c': 3 }, function(a, b) {
        return a === undefined ? b : a;
      });

      assert.deepEqual(actual, { 'a': 1, 'b': 2, 'c': 3 });
    });

    QUnit.test('`_.' + methodName + '` should work with a `customizer` that returns `undefined`', function(assert) {
      assert.expect(1);

      var expected = { 'a': 1 };
      assert.deepEqual(func({}, expected, noop), expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.at');

  (function() {
    var args = arguments,
        array = ['a', 'b', 'c'],
        object = { 'a': [{ 'b': { 'c': 3 } }, 4] };

    QUnit.test('should return the elements corresponding to the specified keys', function(assert) {
      assert.expect(1);

      var actual = _.at(array, [0, 2]);
      assert.deepEqual(actual, ['a', 'c']);
    });

    QUnit.test('should return `undefined` for nonexistent keys', function(assert) {
      assert.expect(1);

      var actual = _.at(array, [2, 4, 0]);
      assert.deepEqual(actual, ['c', undefined, 'a']);
    });

    QUnit.test('should work with non-index keys on array values', function(assert) {
      assert.expect(1);

      var values = lodashStable.reject(empties, function(value) {
        return (value === 0) || lodashStable.isArray(value);
      }).concat(-1, 1.1);

      var array = lodashStable.transform(values, function(result, value) {
        result[value] = 1;
      }, []);

      var expected = lodashStable.map(values, stubOne),
          actual = _.at(array, values);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an empty array when no keys are given', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.at(array), []);
      assert.deepEqual(_.at(array, [], []), []);
    });

    QUnit.test('should accept multiple key arguments', function(assert) {
      assert.expect(1);

      var actual = _.at(['a', 'b', 'c', 'd'], 3, 0, 2);
      assert.deepEqual(actual, ['d', 'a', 'c']);
    });

    QUnit.test('should work with a falsey `object` argument when keys are given', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, lodashStable.constant(Array(4)));

      var actual = lodashStable.map(falsey, function(object) {
        try {
          return _.at(object, 0, 1, 'pop', 'push');
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with an `arguments` object for `object`', function(assert) {
      assert.expect(1);

      var actual = _.at(args, [2, 0]);
      assert.deepEqual(actual, [3, 1]);
    });

    QUnit.test('should work with `arguments` object as secondary arguments', function(assert) {
      assert.expect(1);

      var actual = _.at([1, 2, 3, 4, 5], args);
      assert.deepEqual(actual, [2, 3, 4]);
    });

    QUnit.test('should work with an object for `object`', function(assert) {
      assert.expect(1);

      var actual = _.at(object, ['a[0].b.c', 'a[1]']);
      assert.deepEqual(actual, [3, 4]);
    });

    QUnit.test('should pluck inherited property values', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var actual = _.at(new Foo, 'b');
      assert.deepEqual(actual, [2]);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        var largeArray = lodashStable.range(LARGE_ARRAY_SIZE),
            smallArray = array;

        lodashStable.each([[2], ['2'], [2, 1]], function(paths) {
          lodashStable.times(2, function(index) {
            var array = index ? largeArray : smallArray,
                wrapped = _(array).map(identity).at(paths);

            assert.deepEqual(wrapped.value(), _.at(_.map(array, identity), paths));
          });
        });
      }
      else {
        skipAssert(assert, 6);
      }
    });

    QUnit.test('should support shortcut fusion', function(assert) {
      assert.expect(8);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            count = 0,
            iteratee = function(value) { count++; return square(value); },
            lastIndex = LARGE_ARRAY_SIZE - 1;

        lodashStable.each([lastIndex, lastIndex + '', LARGE_ARRAY_SIZE, []], function(n, index) {
          count = 0;
          var actual = _(array).map(iteratee).at(n).value(),
              expected = index < 2 ? 1 : 0;

          assert.strictEqual(count, expected);

          expected = index == 3 ? [] : [index == 2 ? undefined : square(lastIndex)];
          assert.deepEqual(actual, expected);
        });
      }
      else {
        skipAssert(assert, 8);
      }
    });

    QUnit.test('work with an object for `object` when chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var paths = ['a[0].b.c', 'a[1]'],
            actual = _(object).map(identity).at(paths).value();

        assert.deepEqual(actual, _.at(_.map(object, identity), paths));

        var indexObject = { '0': 1 };
        actual = _(indexObject).at(0).value();
        assert.deepEqual(actual, _.at(indexObject, 0));
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.attempt');

  (function() {
    QUnit.test('should return the result of `func`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.attempt(lodashStable.constant('x')), 'x');
    });

    QUnit.test('should provide additional arguments to `func`', function(assert) {
      assert.expect(1);

      var actual = _.attempt(function() { return slice.call(arguments); }, 1, 2);
      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('should return the caught error', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(errors, stubTrue);

      var actual = lodashStable.map(errors, function(error) {
        return _.attempt(function() { throw error; }) === error;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should coerce errors to error objects', function(assert) {
      assert.expect(1);

      var actual = _.attempt(function() { throw 'x'; });
      assert.ok(lodashStable.isEqual(actual, Error('x')));
    });

    QUnit.test('should preserve custom errors', function(assert) {
      assert.expect(1);

      var actual = _.attempt(function() { throw new CustomError('x'); });
      assert.ok(actual instanceof CustomError);
    });

    QUnit.test('should work with an error object from another realm', function(assert) {
      assert.expect(1);

      if (realm.errors) {
        var expected = lodashStable.map(realm.errors, stubTrue);

        var actual = lodashStable.map(realm.errors, function(error) {
          return _.attempt(function() { throw error; }) === error;
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.strictEqual(_(lodashStable.constant('x')).attempt(), 'x');
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(lodashStable.constant('x')).chain().attempt() instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.before');

  (function() {
    function before(n, times) {
      var count = 0;
      lodashStable.times(times, _.before(n, function() { count++; }));
      return count;
    }

    QUnit.test('should create a function that invokes `func` after `n` calls', function(assert) {
      assert.expect(4);

      assert.strictEqual(before(5, 4), 4, 'before(n) should invoke `func` before being called `n` times');
      assert.strictEqual(before(5, 6), 4, 'before(n) should not invoke `func` after being called `n - 1` times');
      assert.strictEqual(before(0, 0), 0, 'before(0) should not invoke `func` immediately');
      assert.strictEqual(before(0, 1), 0, 'before(0) should not invoke `func` when called');
    });

    QUnit.test('should coerce `n` values of `NaN` to `0`', function(assert) {
      assert.expect(1);

      assert.strictEqual(before(NaN, 1), 0);
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(2);

      var before = _.before(2, function(assert) { return ++this.count; }),
          object = { 'before': before, 'count': 0 };

      object.before();
      assert.strictEqual(object.before(), 1);
      assert.strictEqual(object.count, 1);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.bind');

  (function() {
    function fn() {
      var result = [this];
      push.apply(result, arguments);
      return result;
    }

    QUnit.test('should bind a function to an object', function(assert) {
      assert.expect(1);

      var object = {},
          bound = _.bind(fn, object);

      assert.deepEqual(bound('a'), [object, 'a']);
    });

    QUnit.test('should accept a falsey `thisArg` argument', function(assert) {
      assert.expect(1);

      var values = lodashStable.reject(falsey.slice(1), function(value) { return value == null; }),
          expected = lodashStable.map(values, function(value) { return [value]; });

      var actual = lodashStable.map(values, function(value) {
        try {
          var bound = _.bind(fn, value);
          return bound();
        } catch (e) {}
      });

      assert.ok(lodashStable.every(actual, function(value, index) {
        return lodashStable.isEqual(value, expected[index]);
      }));
    });

    QUnit.test('should bind a function to nullish values', function(assert) {
      assert.expect(6);

      var bound = _.bind(fn, null),
          actual = bound('a');

      assert.ok((actual[0] === null) || (actual[0] && actual[0].Array));
      assert.strictEqual(actual[1], 'a');

      lodashStable.times(2, function(index) {
        bound = index ? _.bind(fn, undefined) : _.bind(fn);
        actual = bound('b');

        assert.ok((actual[0] === undefined) || (actual[0] && actual[0].Array));
        assert.strictEqual(actual[1], 'b');
      });
    });

    QUnit.test('should partially apply arguments ', function(assert) {
      assert.expect(4);

      var object = {},
          bound = _.bind(fn, object, 'a');

      assert.deepEqual(bound(), [object, 'a']);

      bound = _.bind(fn, object, 'a');
      assert.deepEqual(bound('b'), [object, 'a', 'b']);

      bound = _.bind(fn, object, 'a', 'b');
      assert.deepEqual(bound(), [object, 'a', 'b']);
      assert.deepEqual(bound('c', 'd'), [object, 'a', 'b', 'c', 'd']);
    });

    QUnit.test('should support placeholders', function(assert) {
      assert.expect(4);

      var object = {},
          ph = _.bind.placeholder,
          bound = _.bind(fn, object, ph, 'b', ph);

      assert.deepEqual(bound('a', 'c'), [object, 'a', 'b', 'c']);
      assert.deepEqual(bound('a'), [object, 'a', 'b', undefined]);
      assert.deepEqual(bound('a', 'c', 'd'), [object, 'a', 'b', 'c', 'd']);
      assert.deepEqual(bound(), [object, undefined, 'b', undefined]);
    });

    QUnit.test('should use `_.placeholder` when set', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var _ph = _.placeholder = {},
            ph = _.bind.placeholder,
            object = {},
            bound = _.bind(fn, object, _ph, 'b', ph);

        assert.deepEqual(bound('a', 'c'), [object, 'a', 'b', ph, 'c']);
        delete _.placeholder;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should create a function with a `length` of `0`', function(assert) {
      assert.expect(2);

      var fn = function(a, b, c) {},
          bound = _.bind(fn, {});

      assert.strictEqual(bound.length, 0);

      bound = _.bind(fn, {}, 1);
      assert.strictEqual(bound.length, 0);
    });

    QUnit.test('should ignore binding when called with the `new` operator', function(assert) {
      assert.expect(3);

      function Foo() {
        return this;
      }

      var bound = _.bind(Foo, { 'a': 1 }),
          newBound = new bound;

      assert.strictEqual(bound().a, 1);
      assert.strictEqual(newBound.a, undefined);
      assert.ok(newBound instanceof Foo);
    });

    QUnit.test('should handle a number of arguments when called with the `new` operator', function(assert) {
      assert.expect(1);

      function Foo() {
        return this;
      }

      function Bar() {}

      var thisArg = { 'a': 1 },
          boundFoo = _.bind(Foo, thisArg),
          boundBar = _.bind(Bar, thisArg),
          count = 9,
          expected = lodashStable.times(count, lodashStable.constant([undefined, undefined]));

      var actual = lodashStable.times(count, function(index) {
        try {
          switch (index) {
            case 0: return [new boundFoo().a, new boundBar().a];
            case 1: return [new boundFoo(1).a, new boundBar(1).a];
            case 2: return [new boundFoo(1, 2).a, new boundBar(1, 2).a];
            case 3: return [new boundFoo(1, 2, 3).a, new boundBar(1, 2, 3).a];
            case 4: return [new boundFoo(1, 2, 3, 4).a, new boundBar(1, 2, 3, 4).a];
            case 5: return [new boundFoo(1, 2, 3, 4, 5).a, new boundBar(1, 2, 3, 4, 5).a];
            case 6: return [new boundFoo(1, 2, 3, 4, 5, 6).a, new boundBar(1, 2, 3, 4, 5, 6).a];
            case 7: return [new boundFoo(1, 2, 3, 4, 5, 6, 7).a, new boundBar(1, 2, 3, 4, 5, 6, 7).a];
            case 8: return [new boundFoo(1, 2, 3, 4, 5, 6, 7, 8).a, new boundBar(1, 2, 3, 4, 5, 6, 7, 8).a];
          }
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should ensure `new bound` is an instance of `func`', function(assert) {
      assert.expect(2);

      function Foo(value) {
        return value && object;
      }

      var bound = _.bind(Foo),
          object = {};

      assert.ok(new bound instanceof Foo);
      assert.strictEqual(new bound(true), object);
    });

    QUnit.test('should append array arguments to partially applied arguments', function(assert) {
      assert.expect(1);

      var object = {},
          bound = _.bind(fn, object, 'a');

      assert.deepEqual(bound(['b'], 'c'), [object, 'a', ['b'], 'c']);
    });

    QUnit.test('should not rebind functions', function(assert) {
      assert.expect(3);

      var object1 = {},
          object2 = {},
          object3 = {};

      var bound1 = _.bind(fn, object1),
          bound2 = _.bind(bound1, object2, 'a'),
          bound3 = _.bind(bound1, object3, 'b');

      assert.deepEqual(bound1(), [object1]);
      assert.deepEqual(bound2(), [object1, 'a']);
      assert.deepEqual(bound3(), [object1, 'b']);
    });

    QUnit.test('should not error when instantiating bound built-ins', function(assert) {
      assert.expect(2);

      var Ctor = _.bind(Date, null),
          expected = new Date(2012, 4, 23, 0, 0, 0, 0);

      try {
        var actual = new Ctor(2012, 4, 23, 0, 0, 0, 0);
      } catch (e) {}

      assert.deepEqual(actual, expected);

      Ctor = _.bind(Date, null, 2012, 4, 23);

      try {
        actual = new Ctor(0, 0, 0, 0);
      } catch (e) {}

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not error when calling bound class constructors with the `new` operator', function(assert) {
      assert.expect(1);

      var createCtor = lodashStable.attempt(Function, '"use strict";return class A{}');

      if (typeof createCtor == 'function') {
        var bound = _.bind(createCtor()),
            count = 8,
            expected = lodashStable.times(count, stubTrue);

        var actual = lodashStable.times(count, function(index) {
          try {
            switch (index) {
              case 0: return !!(new bound);
              case 1: return !!(new bound(1));
              case 2: return !!(new bound(1, 2));
              case 3: return !!(new bound(1, 2, 3));
              case 4: return !!(new bound(1, 2, 3, 4));
              case 5: return !!(new bound(1, 2, 3, 4, 5));
              case 6: return !!(new bound(1, 2, 3, 4, 5, 6));
              case 7: return !!(new bound(1, 2, 3, 4, 5, 6, 7));
            }
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var object = {},
            bound = _(fn).bind({}, 'a', 'b');

        assert.ok(bound instanceof _);

        var actual = bound.value()('c');
        assert.deepEqual(actual, [object, 'a', 'b', 'c']);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.bindAll');

  (function() {
    var args = arguments;

    var source = {
      '_n0': -2,
      '_p0': -1,
      '_a': 1,
      '_b': 2,
      '_c': 3,
      '_d': 4,
      '-0': function() { return this._n0; },
      '0': function() { return this._p0; },
      'a': function() { return this._a; },
      'b': function() { return this._b; },
      'c': function() { return this._c; },
      'd': function() { return this._d; }
    };

    QUnit.test('should accept individual method names', function(assert) {
      assert.expect(1);

      var object = lodashStable.cloneDeep(source);
      _.bindAll(object, 'a', 'b');

      var actual = lodashStable.map(['a', 'b', 'c'], function(key) {
        return object[key].call({});
      });

      assert.deepEqual(actual, [1, 2, undefined]);
    });

    QUnit.test('should accept arrays of method names', function(assert) {
      assert.expect(1);

      var object = lodashStable.cloneDeep(source);
      _.bindAll(object, ['a', 'b'], ['c']);

      var actual = lodashStable.map(['a', 'b', 'c', 'd'], function(key) {
        return object[key].call({});
      });

      assert.deepEqual(actual, [1, 2, 3, undefined]);
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var props = [-0, Object(-0), 0, Object(0)];

      var actual = lodashStable.map(props, function(key) {
        var object = lodashStable.cloneDeep(source);
        _.bindAll(object, key);
        return object[lodashStable.toString(key)].call({});
      });

      assert.deepEqual(actual, [-2, -2, -1, -1]);
    });

    QUnit.test('should work with an array `object` argument', function(assert) {
      assert.expect(1);

      var array = ['push', 'pop'];
      _.bindAll(array);
      assert.strictEqual(array.pop, arrayProto.pop);
    });

    QUnit.test('should work with `arguments` objects as secondary arguments', function(assert) {
      assert.expect(1);

      var object = lodashStable.cloneDeep(source);
      _.bindAll(object, args);

      var actual = lodashStable.map(args, function(key) {
        return object[key].call({});
      });

      assert.deepEqual(actual, [1]);
    });
  }('a'));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.bindKey');

  (function() {
    QUnit.test('should work when the target function is overwritten', function(assert) {
      assert.expect(2);

      var object = {
        'user': 'fred',
        'greet': function(greeting) {
          return this.user + ' says: ' + greeting;
        }
      };

      var bound = _.bindKey(object, 'greet', 'hi');
      assert.strictEqual(bound(), 'fred says: hi');

      object.greet = function(greeting) {
        return this.user + ' says: ' + greeting + '!';
      };

      assert.strictEqual(bound(), 'fred says: hi!');
    });

    QUnit.test('should support placeholders', function(assert) {
      assert.expect(4);

      var object = {
        'fn': function() {
          return slice.call(arguments);
        }
      };

      var ph = _.bindKey.placeholder,
          bound = _.bindKey(object, 'fn', ph, 'b', ph);

      assert.deepEqual(bound('a', 'c'), ['a', 'b', 'c']);
      assert.deepEqual(bound('a'), ['a', 'b', undefined]);
      assert.deepEqual(bound('a', 'c', 'd'), ['a', 'b', 'c', 'd']);
      assert.deepEqual(bound(), [undefined, 'b', undefined]);
    });

    QUnit.test('should use `_.placeholder` when set', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var object = {
          'fn': function() {
            return slice.call(arguments);
          }
        };

        var _ph = _.placeholder = {},
            ph = _.bindKey.placeholder,
            bound = _.bindKey(object, 'fn', _ph, 'b', ph);

        assert.deepEqual(bound('a', 'c'), ['a', 'b', ph, 'c']);
        delete _.placeholder;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should ensure `new bound` is an instance of `object[key]`', function(assert) {
      assert.expect(2);

      function Foo(value) {
        return value && object;
      }

      var object = { 'Foo': Foo },
          bound = _.bindKey(object, 'Foo');

      assert.ok(new bound instanceof Foo);
      assert.strictEqual(new bound(true), object);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('case methods');

  lodashStable.each(['camel', 'kebab', 'lower', 'snake', 'start', 'upper'], function(caseName) {
    var methodName = caseName + 'Case',
        func = _[methodName];

    var strings = [
      'foo bar', 'Foo bar', 'foo Bar', 'Foo Bar',
      'FOO BAR', 'fooBar', '--foo-bar--', '__foo_bar__'
    ];

    var converted = (function() {
      switch (caseName) {
        case 'camel': return 'fooBar';
        case 'kebab': return 'foo-bar';
        case 'lower': return 'foo bar';
        case 'snake': return 'foo_bar';
        case 'start': return 'Foo Bar';
        case 'upper': return 'FOO BAR';
      }
    }());

    QUnit.test('`_.' + methodName + '` should convert `string` to ' + caseName + ' case', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(strings, function(string) {
        var expected = (caseName == 'start' && string == 'FOO BAR') ? string : converted;
        return func(string) === expected;
      });

      assert.deepEqual(actual, lodashStable.map(strings, stubTrue));
    });

    QUnit.test('`_.' + methodName + '` should handle double-converting strings', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(strings, function(string) {
        var expected = (caseName == 'start' && string == 'FOO BAR') ? string : converted;
        return func(func(string)) === expected;
      });

      assert.deepEqual(actual, lodashStable.map(strings, stubTrue));
    });

    QUnit.test('`_.' + methodName + '` should deburr letters', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(burredLetters, function(burred, index) {
        var letter = deburredLetters[index].replace(/['\u2019]/g, '');
        if (caseName == 'start') {
          letter = letter == 'IJ' ? letter : lodashStable.capitalize(letter);
        } else if (caseName == 'upper') {
          letter = letter.toUpperCase();
        } else {
          letter = letter.toLowerCase();
        }
        return func(burred) === letter;
      });

      assert.deepEqual(actual, lodashStable.map(burredLetters, stubTrue));
    });

    QUnit.test('`_.' + methodName + '` should remove contraction apostrophes', function(assert) {
      assert.expect(2);

      var postfixes = ['d', 'll', 'm', 're', 's', 't', 've'];

      lodashStable.each(["'", '\u2019'], function(apos) {
        var actual = lodashStable.map(postfixes, function(postfix) {
          return func('a b' + apos + postfix +  ' c');
        });

        var expected = lodashStable.map(postfixes, function(postfix) {
          switch (caseName) {
            case 'camel': return 'aB'  + postfix + 'C';
            case 'kebab': return 'a-b' + postfix + '-c';
            case 'lower': return 'a b' + postfix + ' c';
            case 'snake': return 'a_b' + postfix + '_c';
            case 'start': return 'A B' + postfix + ' C';
            case 'upper': return 'A B' + postfix.toUpperCase() + ' C';
          }
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should remove Latin mathematical operators', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(['\xd7', '\xf7'], func);
      assert.deepEqual(actual, ['', '']);
    });

    QUnit.test('`_.' + methodName + '` should coerce `string` to a string', function(assert) {
      assert.expect(2);

      var string = 'foo bar';
      assert.strictEqual(func(Object(string)), converted);
      assert.strictEqual(func({ 'toString': lodashStable.constant(string) }), converted);
    });

    QUnit.test('`_.' + methodName + '` should return an unwrapped value implicitly when chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.strictEqual(_('foo bar')[methodName](), converted);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_('foo bar').chain()[methodName]() instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  (function() {
    QUnit.test('should get the original value after cycling through all case methods', function(assert) {
      assert.expect(1);

      var funcs = [_.camelCase, _.kebabCase, _.lowerCase, _.snakeCase, _.startCase, _.lowerCase, _.camelCase];

      var actual = lodashStable.reduce(funcs, function(result, func) {
        return func(result);
      }, 'enable 6h format');

      assert.strictEqual(actual, 'enable6HFormat');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.camelCase');

  (function() {
    QUnit.test('should work with numbers', function(assert) {
      assert.expect(6);

      assert.strictEqual(_.camelCase('12 feet'), '12Feet');
      assert.strictEqual(_.camelCase('enable 6h format'), 'enable6HFormat');
      assert.strictEqual(_.camelCase('enable 24H format'), 'enable24HFormat');
      assert.strictEqual(_.camelCase('too legit 2 quit'), 'tooLegit2Quit');
      assert.strictEqual(_.camelCase('walk 500 miles'), 'walk500Miles');
      assert.strictEqual(_.camelCase('xhr2 request'), 'xhr2Request');
    });

    QUnit.test('should handle acronyms', function(assert) {
      assert.expect(6);

      lodashStable.each(['safe HTML', 'safeHTML'], function(string) {
        assert.strictEqual(_.camelCase(string), 'safeHtml');
      });

      lodashStable.each(['escape HTML entities', 'escapeHTMLEntities'], function(string) {
        assert.strictEqual(_.camelCase(string), 'escapeHtmlEntities');
      });

      lodashStable.each(['XMLHttpRequest', 'XmlHTTPRequest'], function(string) {
        assert.strictEqual(_.camelCase(string), 'xmlHttpRequest');
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.capitalize');

  (function() {
    QUnit.test('should capitalize the first character of a string', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.capitalize('fred'), 'Fred');
      assert.strictEqual(_.capitalize('Fred'), 'Fred');
      assert.strictEqual(_.capitalize(' fred'), ' fred');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.castArray');

  (function() {
    QUnit.test('should wrap non-array items in an array', function(assert) {
      assert.expect(1);

      var values = falsey.concat(true, 1, 'a', { 'a': 1 }),
          expected = lodashStable.map(values, function(value) { return [value]; }),
          actual = lodashStable.map(values, _.castArray);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return array values by reference', function(assert) {
      assert.expect(1);

      var array = [1];
      assert.strictEqual(_.castArray(array), array);
    });

    QUnit.test('should return an empty array when no arguments are given', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.castArray(), []);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.chain');

  (function() {
    QUnit.test('should return a wrapped value', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var actual = _.chain({ 'a': 0 });
        assert.ok(actual instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return existing wrapped values', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _({ 'a': 0 });
        assert.strictEqual(_.chain(wrapped), wrapped);
        assert.strictEqual(wrapped.chain(), wrapped);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should enable chaining for methods that return unwrapped values', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        var array = ['c', 'b', 'a'];

        assert.ok(_.chain(array).head() instanceof _);
        assert.ok(_(array).chain().head() instanceof _);

        assert.ok(_.chain(array).isArray() instanceof _);
        assert.ok(_(array).chain().isArray() instanceof _);

        assert.ok(_.chain(array).sortBy().head() instanceof _);
        assert.ok(_(array).chain().sortBy().head() instanceof _);
      }
      else {
        skipAssert(assert, 6);
      }
    });

    QUnit.test('should chain multiple methods', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        lodashStable.times(2, function(index) {
          var array = ['one two three four', 'five six seven eight', 'nine ten eleven twelve'],
              expected = { ' ': 9, 'e': 14, 'f': 2, 'g': 1, 'h': 2, 'i': 4, 'l': 2, 'n': 6, 'o': 3, 'r': 2, 's': 2, 't': 5, 'u': 1, 'v': 4, 'w': 2, 'x': 1 },
              wrapped = index ? _(array).chain() : _.chain(array);

          var actual = wrapped
            .chain()
            .map(function(value) { return value.split(''); })
            .flatten()
            .reduce(function(object, chr) {
              object[chr] || (object[chr] = 0);
              object[chr]++;
              return object;
            }, {})
            .value();

          assert.deepEqual(actual, expected);

          array = [1, 2, 3, 4, 5, 6];
          wrapped = index ? _(array).chain() : _.chain(array);
          actual = wrapped
            .chain()
            .filter(function(n) { return n % 2 != 0; })
            .reject(function(n) { return n % 3 == 0; })
            .sortBy(function(n) { return -n; })
            .value();

          assert.deepEqual(actual, [5, 1]);

          array = [3, 4];
          wrapped = index ? _(array).chain() : _.chain(array);
          actual = wrapped
            .reverse()
            .concat([2, 1])
            .unshift(5)
            .tap(function(value) { value.pop(); })
            .map(square)
            .value();

          assert.deepEqual(actual, [25, 16, 9, 4]);
        });
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.chunk');

  (function() {
    var array = [0, 1, 2, 3, 4, 5];

    QUnit.test('should return chunked arrays', function(assert) {
      assert.expect(1);

      var actual = _.chunk(array, 3);
      assert.deepEqual(actual, [[0, 1, 2], [3, 4, 5]]);
    });

    QUnit.test('should return the last chunk as remaining elements', function(assert) {
      assert.expect(1);

      var actual = _.chunk(array, 4);
      assert.deepEqual(actual, [[0, 1, 2, 3], [4, 5]]);
    });

    QUnit.test('should treat falsey `size` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? [[0], [1], [2], [3], [4], [5]] : [];
      });

      var actual = lodashStable.map(falsey, function(size, index) {
        return index ? _.chunk(array, size) : _.chunk(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should ensure the minimum `size` is `0`', function(assert) {
      assert.expect(1);

      var values = lodashStable.reject(falsey, lodashStable.isUndefined).concat(-1, -Infinity),
          expected = lodashStable.map(values, stubArray);

      var actual = lodashStable.map(values, function(n) {
        return _.chunk(array, n);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should coerce `size` to an integer', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.chunk(array, array.length / 4), [[0], [1], [2], [3], [4], [5]]);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map([[1, 2], [3, 4]], _.chunk);
      assert.deepEqual(actual, [[[1], [2]], [[3], [4]]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.clamp');

  (function() {
    QUnit.test('should work with a `max` argument', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.clamp(5, 3), 3);
      assert.strictEqual(_.clamp(1, 3), 1);
    });

    QUnit.test('should clamp negative numbers', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.clamp(-10, -5, 5), -5);
      assert.strictEqual(_.clamp(-10.2, -5.5, 5.5), -5.5);
      assert.strictEqual(_.clamp(-Infinity, -5, 5), -5);
    });

    QUnit.test('should clamp positive numbers', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.clamp(10, -5, 5), 5);
      assert.strictEqual(_.clamp(10.6, -5.6, 5.4), 5.4);
      assert.strictEqual(_.clamp(Infinity, -5, 5), 5);
    });

    QUnit.test('should not alter negative numbers in range', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.clamp(-4, -5, 5), -4);
      assert.strictEqual(_.clamp(-5, -5, 5), -5);
      assert.strictEqual(_.clamp(-5.5, -5.6, 5.6), -5.5);
    });

    QUnit.test('should not alter positive numbers in range', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.clamp(4, -5, 5), 4);
      assert.strictEqual(_.clamp(5, -5, 5), 5);
      assert.strictEqual(_.clamp(4.5, -5.1, 5.2), 4.5);
    });

    QUnit.test('should not alter `0` in range', function(assert) {
      assert.expect(1);

      assert.strictEqual(1 / _.clamp(0, -5, 5), Infinity);
    });

    QUnit.test('should clamp to `0`', function(assert) {
      assert.expect(1);

      assert.strictEqual(1 / _.clamp(-10, 0, 5), Infinity);
    });

    QUnit.test('should not alter `-0` in range', function(assert) {
      assert.expect(1);

      assert.strictEqual(1 / _.clamp(-0, -5, 5), -Infinity);
    });

    QUnit.test('should clamp to `-0`', function(assert) {
      assert.expect(1);

      assert.strictEqual(1 / _.clamp(-10, -0, 5), -Infinity);
    });

    QUnit.test('should return `NaN` when `number` is `NaN`', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.clamp(NaN, -5, 5), NaN);
    });

    QUnit.test('should coerce `min` and `max` of `NaN` to `0`', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.clamp(1, -5, NaN), 0);
      assert.deepEqual(_.clamp(-1, NaN, 5), 0);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('clone methods');

  (function() {
    function Foo() {
      this.a = 1;
    }
    Foo.prototype.b = 1;
    Foo.c = function() {};

    if (Map) {
      var map = new Map;
      map.set('a', 1);
      map.set('b', 2);
    }
    if (Set) {
      var set = new Set;
      set.add(1);
      set.add(2);
    }
    var objects = {
      '`arguments` objects': arguments,
      'arrays': ['a', ''],
      'array-like objects': { '0': 'a', 'length': 1 },
      'booleans': false,
      'boolean objects': Object(false),
      'date objects': new Date,
      'Foo instances': new Foo,
      'objects': { 'a': 0, 'b': 1, 'c': 2 },
      'objects with object values': { 'a': /a/, 'b': ['B'], 'c': { 'C': 1 } },
      'objects from another document': realm.object || {},
      'maps': map,
      'null values': null,
      'numbers': 0,
      'number objects': Object(0),
      'regexes': /a/gim,
      'sets': set,
      'strings': 'a',
      'string objects': Object('a'),
      'undefined values': undefined
    };

    objects.arrays.length = 3;

    var uncloneable = {
      'DOM elements': body,
      'functions': Foo,
      'generators': generator
    };

    lodashStable.each(errors, function(error) {
      uncloneable[error.name + 's'] = error;
    });

    QUnit.test('`_.clone` should perform a shallow clone', function(assert) {
      assert.expect(2);

      var array = [{ 'a': 0 }, { 'b': 1 }],
          actual = _.clone(array);

      assert.deepEqual(actual, array);
      assert.ok(actual !== array && actual[0] === array[0]);
    });

    QUnit.test('`_.cloneDeep` should deep clone objects with circular references', function(assert) {
      assert.expect(1);

      var object = {
        'foo': { 'b': { 'c': { 'd': {} } } },
        'bar': {}
      };

      object.foo.b.c.d = object;
      object.bar.b = object.foo.b;

      var actual = _.cloneDeep(object);
      assert.ok(actual.bar.b === actual.foo.b && actual === actual.foo.b.c.d && actual !== object);
    });

    QUnit.test('`_.cloneDeep` should deep clone objects with lots of circular references', function(assert) {
      assert.expect(2);

      var cyclical = {};
      lodashStable.times(LARGE_ARRAY_SIZE + 1, function(index) {
        cyclical['v' + index] = [index ? cyclical['v' + (index - 1)] : cyclical];
      });

      var clone = _.cloneDeep(cyclical),
          actual = clone['v' + LARGE_ARRAY_SIZE][0];

      assert.strictEqual(actual, clone['v' + (LARGE_ARRAY_SIZE - 1)]);
      assert.notStrictEqual(actual, cyclical['v' + (LARGE_ARRAY_SIZE - 1)]);
    });

    QUnit.test('`_.cloneDeepWith` should provide `stack` to `customizer`', function(assert) {
      assert.expect(1);

      var actual;

      _.cloneDeepWith({ 'a': 1 }, function() {
        actual = _.last(arguments);
      });

      assert.ok(isNpm
        ? actual.constructor.name == 'Stack'
        : actual instanceof mapCaches.Stack
      );
    });

    lodashStable.each(['clone', 'cloneDeep'], function(methodName) {
      var func = _[methodName],
          isDeep = methodName == 'cloneDeep';

      lodashStable.forOwn(objects, function(object, kind) {
        QUnit.test('`_.' + methodName + '` should clone ' + kind, function(assert) {
          assert.expect(2);

          var actual = func(object);
          assert.ok(lodashStable.isEqual(actual, object));

          if (lodashStable.isObject(object)) {
            assert.notStrictEqual(actual, object);
          } else {
            assert.strictEqual(actual, object);
          }
        });
      });

      QUnit.test('`_.' + methodName + '` should clone array buffers', function(assert) {
        assert.expect(2);

        if (ArrayBuffer) {
          var actual = func(arrayBuffer);
          assert.strictEqual(actual.byteLength, arrayBuffer.byteLength);
          assert.notStrictEqual(actual, arrayBuffer);
        }
        else {
          skipAssert(assert, 2);
        }
      });

      QUnit.test('`_.' + methodName + '` should clone buffers', function(assert) {
        assert.expect(4);

        if (Buffer) {
          var buffer = new Buffer([1, 2]),
              actual = func(buffer);

          assert.strictEqual(actual.byteLength, buffer.byteLength);
          assert.strictEqual(actual.inspect(), buffer.inspect());
          assert.notStrictEqual(actual, buffer);

          buffer[0] = 2;
          assert.strictEqual(actual[0], isDeep ? 2 : 1);
        }
        else {
          skipAssert(assert, 4);
        }
      });

      QUnit.test('`_.' + methodName + '` should clone `index` and `input` array properties', function(assert) {
        assert.expect(2);

        var array = /c/.exec('abcde'),
            actual = func(array);

        assert.strictEqual(actual.index, 2);
        assert.strictEqual(actual.input, 'abcde');
      });

      QUnit.test('`_.' + methodName + '` should clone `lastIndex` regexp property', function(assert) {
        assert.expect(1);

        var regexp = /c/g;
        regexp.exec('abcde');

        assert.strictEqual(func(regexp).lastIndex, 3);
      });

      QUnit.test('`_.' + methodName + '` should clone expando properties', function(assert) {
        assert.expect(1);

        var values = lodashStable.map([false, true, 1, 'a'], function(value) {
          var object = Object(value);
          object.a = 1;
          return object;
        });

        var expected = lodashStable.map(values, stubTrue);

        var actual = lodashStable.map(values, function(value) {
          return func(value).a === 1;
        });

        assert.deepEqual(actual, expected);
      });

      QUnit.test('`_.' + methodName + '` should clone prototype objects', function(assert) {
        assert.expect(2);

        var actual = func(Foo.prototype);

        assert.notOk(actual instanceof Foo);
        assert.deepEqual(actual, { 'b': 1 });
      });

      QUnit.test('`_.' + methodName + '` should set the `[[Prototype]]` of a clone', function(assert) {
        assert.expect(1);

        assert.ok(func(new Foo) instanceof Foo);
      });

      QUnit.test('`_.' + methodName + '` should set the `[[Prototype]]` of a clone even when the `constructor` is incorrect', function(assert) {
        assert.expect(1);

        Foo.prototype.constructor = Object;
        assert.ok(func(new Foo) instanceof Foo);
        Foo.prototype.constructor = Foo;
      });

      QUnit.test('`_.' + methodName + '` should ensure `value` constructor is a function before using its `[[Prototype]]`', function(assert) {
        assert.expect(1);

        Foo.prototype.constructor = null;
        assert.notOk(func(new Foo) instanceof Foo);
        Foo.prototype.constructor = Foo;
      });

      QUnit.test('`_.' + methodName + '` should clone properties that shadow those on `Object.prototype`', function(assert) {
        assert.expect(2);

        var object = {
          'constructor': objectProto.constructor,
          'hasOwnProperty': objectProto.hasOwnProperty,
          'isPrototypeOf': objectProto.isPrototypeOf,
          'propertyIsEnumerable': objectProto.propertyIsEnumerable,
          'toLocaleString': objectProto.toLocaleString,
          'toString': objectProto.toString,
          'valueOf': objectProto.valueOf
        };

        var actual = func(object);

        assert.deepEqual(actual, object);
        assert.notStrictEqual(actual, object);
      });

      QUnit.test('`_.' + methodName + '` should clone symbol properties', function(assert) {
        assert.expect(3);

        function Foo() {
          this[symbol] = { 'c': 1 };
        }

        if (Symbol) {
          var symbol2 = Symbol('b');
          Foo.prototype[symbol2] = 2;

          var object = { 'a': { 'b': new Foo } };
          object[symbol] = { 'b': 1 };

          var actual = func(object);

          assert.deepEqual(getSymbols(actual.a.b), [symbol]);

          if (isDeep) {
            assert.deepEqual(actual[symbol], object[symbol]);
            assert.deepEqual(actual.a.b[symbol], object.a.b[symbol]);
          }
          else {
            assert.strictEqual(actual[symbol], object[symbol]);
            assert.strictEqual(actual.a, object.a);
          }
        }
        else {
          skipAssert(assert, 3);
        }
      });

      QUnit.test('`_.' + methodName + '` should clone symbol objects', function(assert) {
        assert.expect(4);

        if (Symbol) {
          assert.strictEqual(func(symbol), symbol);

          var object = Object(symbol),
              actual = func(object);

          assert.strictEqual(typeof actual, 'object');
          assert.strictEqual(typeof actual.valueOf(), 'symbol');
          assert.notStrictEqual(actual, object);
        }
        else {
          skipAssert(assert, 4);
        }
      });

      QUnit.test('`_.' + methodName + '` should not clone symbol primitives', function(assert) {
        assert.expect(1);

        if (Symbol) {
          assert.strictEqual(func(symbol), symbol);
        }
        else {
          skipAssert(assert);
        }
      });

      QUnit.test('`_.' + methodName + '` should not error on DOM elements', function(assert) {
        assert.expect(1);

        if (document) {
          var element = document.createElement('div');

          try {
            assert.deepEqual(func(element), {});
          } catch (e) {
            assert.ok(false, e.message);
          }
        }
        else {
          skipAssert(assert);
        }
      });

      QUnit.test('`_.' + methodName + '` should create an object from the same realm as `value`', function(assert) {
        assert.expect(1);

        var props = [];

        var objects = lodashStable.transform(_, function(result, value, key) {
          if (lodashStable.startsWith(key, '_') && lodashStable.isObject(value) &&
              !lodashStable.isArguments(value) && !lodashStable.isElement(value) &&
              !lodashStable.isFunction(value)) {
            props.push(lodashStable.capitalize(lodashStable.camelCase(key)));
            result.push(value);
          }
        }, []);

        var expected = lodashStable.map(objects, stubTrue);

        var actual = lodashStable.map(objects, function(object) {
          var Ctor = object.constructor,
              result = func(object);

          return result !== object && ((result instanceof Ctor) || !(new Ctor instanceof Ctor));
        });

        assert.deepEqual(actual, expected, props.join(', '));
      });

      QUnit.test('`_.' + methodName + '` should perform a ' + (isDeep ? 'deep' : 'shallow') + ' clone when used as an iteratee for methods like `_.map`', function(assert) {
        assert.expect(2);

        var expected = [{ 'a': [0] }, { 'b': [1] }],
            actual = lodashStable.map(expected, func);

        assert.deepEqual(actual, expected);

        if (isDeep) {
          assert.ok(actual[0] !== expected[0] && actual[0].a !== expected[0].a && actual[1].b !== expected[1].b);
        } else {
          assert.ok(actual[0] !== expected[0] && actual[0].a === expected[0].a && actual[1].b === expected[1].b);
        }
      });

      QUnit.test('`_.' + methodName + '` should return a unwrapped value when chaining', function(assert) {
        assert.expect(2);

        if (!isNpm) {
          var object = objects.objects,
              actual = _(object)[methodName]();

          assert.deepEqual(actual, object);
          assert.notStrictEqual(actual, object);
        }
        else {
          skipAssert(assert, 2);
        }
      });

      lodashStable.each(arrayViews, function(type) {
        QUnit.test('`_.' + methodName + '` should clone ' + type + ' values', function(assert) {
          assert.expect(10);

          var Ctor = root[type];

          lodashStable.times(2, function(index) {
            if (Ctor) {
              var buffer = new ArrayBuffer(24),
                  view = index ? new Ctor(buffer, 8, 1) : new Ctor(buffer),
                  actual = func(view);

              assert.deepEqual(actual, view);
              assert.notStrictEqual(actual, view);
              assert.strictEqual(actual.buffer === view.buffer, !isDeep);
              assert.strictEqual(actual.byteOffset, view.byteOffset);
              assert.strictEqual(actual.length, view.length);
            }
            else {
              skipAssert(assert, 5);
            }
          });
        });
      });

      lodashStable.forOwn(uncloneable, function(value, key) {
        QUnit.test('`_.' + methodName + '` should not clone ' + key, function(assert) {
          assert.expect(3);

          if (value) {
            var object = { 'a': value, 'b': { 'c': value } },
                actual = func(object),
                expected = (typeof value == 'function' && !!value.c) ? { 'c': Foo.c } : {};

            assert.deepEqual(actual, object);
            assert.notStrictEqual(actual, object);
            assert.deepEqual(func(value), expected);
          }
          else {
            skipAssert(assert, 3);
          }
        });
      });
    });

    lodashStable.each(['cloneWith', 'cloneDeepWith'], function(methodName) {
      var func = _[methodName],
          isDeep = methodName == 'cloneDeepWith';

      QUnit.test('`_.' + methodName + '` should provide correct `customizer` arguments', function(assert) {
        assert.expect(1);

        var argsList = [],
            object = new Foo;

        func(object, function() {
          var length = arguments.length,
              args = slice.call(arguments, 0, length - (length > 1 ? 1 : 0));

          argsList.push(args);
        });

        assert.deepEqual(argsList, isDeep ? [[object], [1, 'a', object]] : [[object]]);
      });

      QUnit.test('`_.' + methodName + '` should handle cloning when `customizer` returns `undefined`', function(assert) {
        assert.expect(1);

        var actual = func({ 'a': { 'b': 'c' } }, noop);
        assert.deepEqual(actual, { 'a': { 'b': 'c' } });
      });

      lodashStable.forOwn(uncloneable, function(value, key) {
        QUnit.test('`_.' + methodName + '` should work with a `customizer` callback and ' + key, function(assert) {
          assert.expect(3);

          var customizer = function(value) {
            return lodashStable.isPlainObject(value) ? undefined : value;
          };

          var actual = func(value, customizer);
          assert.strictEqual(actual, value);

          var object = { 'a': value, 'b': { 'c': value } };
          actual = func(object, customizer);

          assert.deepEqual(actual, object);
          assert.notStrictEqual(actual, object);
        });
      });
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.compact');

  (function() {
    var largeArray = lodashStable.range(LARGE_ARRAY_SIZE).concat(null);

    QUnit.test('should filter falsey values', function(assert) {
      assert.expect(1);

      var array = ['0', '1', '2'];
      assert.deepEqual(_.compact(falsey.concat(array)), array);
    });

    QUnit.test('should work when in-between lazy operators', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var actual = _(falsey).thru(_.slice).compact().thru(_.slice).value();
        assert.deepEqual(actual, []);

        actual = _(falsey).thru(_.slice).push(true, 1).compact().push('a').value();
        assert.deepEqual(actual, [true, 1, 'a']);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var actual = _(largeArray).slice(1).compact().reverse().take().value();
        assert.deepEqual(actual, _.take(_.compact(_.slice(largeArray, 1)).reverse()));
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should work in a lazy sequence with a custom `_.iteratee`', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var iteratee = _.iteratee,
            pass = false;

        _.iteratee = identity;

        try {
          var actual = _(largeArray).slice(1).compact().value();
          pass = lodashStable.isEqual(actual, _.compact(_.slice(largeArray, 1)));
        } catch (e) {console.log(e);}

        assert.ok(pass);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.concat');

  (function() {
    QUnit.test('should shallow clone `array`', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3],
          actual = _.concat(array);

      assert.deepEqual(actual, array);
      assert.notStrictEqual(actual, array);
    });

    QUnit.test('should concat arrays and values', function(assert) {
      assert.expect(2);

      var array = [1],
          actual = _.concat(array, 2, [3], [[4]]);

      assert.deepEqual(actual, [1, 2, 3, [4]]);
      assert.deepEqual(array, [1]);
    });

    QUnit.test('should cast non-array `array` values to arrays', function(assert) {
      assert.expect(2);

      var values = [, null, undefined, false, true, 1, NaN, 'a'];

      var expected = lodashStable.map(values, function(value, index) {
        return index ? [value] : [];
      });

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.concat(value) : _.concat();
      });

      assert.deepEqual(actual, expected);

      expected = lodashStable.map(values, function(value) {
        return [value, 2, [3]];
      });

      actual = lodashStable.map(values, function(value) {
        return _.concat(value, [2], [[3]]);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should treat sparse arrays as dense', function(assert) {
      assert.expect(3);

      var expected = [],
          actual = _.concat(Array(1), Array(1));

      expected.push(undefined, undefined);

      assert.ok('0'in actual);
      assert.ok('1' in actual);
      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return a new wrapped array', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var array = [1],
            wrapped = _(array).concat([2, 3]),
            actual = wrapped.value();

        assert.deepEqual(array, [1]);
        assert.deepEqual(actual, [1, 2, 3]);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.cond');

  (function() {
    QUnit.test('should create a conditional function', function(assert) {
      assert.expect(3);

      var cond = _.cond([
        [lodashStable.matches({ 'a': 1 }),     stubA],
        [lodashStable.matchesProperty('b', 1), stubB],
        [lodashStable.property('c'),           stubC]
      ]);

      assert.strictEqual(cond({ 'a':  1, 'b': 2, 'c': 3 }), 'a');
      assert.strictEqual(cond({ 'a':  0, 'b': 1, 'c': 2 }), 'b');
      assert.strictEqual(cond({ 'a': -1, 'b': 0, 'c': 1 }), 'c');
    });

    QUnit.test('should provide arguments to functions', function(assert) {
      assert.expect(2);

      var args1,
          args2,
          expected = ['a', 'b', 'c'];

      var cond = _.cond([[
        function() { args1 || (args1 = slice.call(arguments)); return true; },
        function() { args2 || (args2 = slice.call(arguments)); }
      ]]);

      cond('a', 'b', 'c');

      assert.deepEqual(args1, expected);
      assert.deepEqual(args2, expected);
    });

    QUnit.test('should work with predicate shorthands', function(assert) {
      assert.expect(3);

      var cond = _.cond([
        [{ 'a': 1 }, stubA],
        [['b', 1],   stubB],
        ['c',        stubC]
      ]);

      assert.strictEqual(cond({ 'a':  1, 'b': 2, 'c': 3 }), 'a');
      assert.strictEqual(cond({ 'a':  0, 'b': 1, 'c': 2 }), 'b');
      assert.strictEqual(cond({ 'a': -1, 'b': 0, 'c': 1 }), 'c');
    });

    QUnit.test('should return `undefined` when no condition is met', function(assert) {
      assert.expect(1);

      var cond = _.cond([[stubFalse, stubA]]);
      assert.strictEqual(cond({ 'a': 1 }), undefined);
    });

    QUnit.test('should throw a TypeError if `pairs` is not composed of functions', function(assert) {
      assert.expect(2);

      lodashStable.each([false, true], function(value) {
        assert.raises(function() { _.cond([[stubTrue, value]])(); }, TypeError);
      });
    });

    QUnit.test('should use `this` binding of function for `pairs`', function(assert) {
      assert.expect(1);

      var cond = _.cond([
        [function(a) { return this[a]; }, function(a, b) { return this[b]; }]
      ]);

      var object = { 'cond': cond, 'a': 1, 'b': 2 };
      assert.strictEqual(object.cond('a', 'b'), 2);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.conforms');

  (function() {
    QUnit.test('should not change behavior if `source` is modified', function(assert) {
      assert.expect(2);

      var object = { 'a': 2 },
          source = { 'a': function(value) { return value > 1; } },
          par = _.conforms(source);

      assert.strictEqual(par(object), true);

      source.a = function(value) { return value < 2; };
      assert.strictEqual(par(object), true);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('conforms methods');

  lodashStable.each(['conforms', 'conformsTo'], function(methodName) {
    var isConforms = methodName == 'conforms';

    function conforms(source) {
      return isConforms ? _.conforms(source) : function(object) {
        return _.conformsTo(object, source);
      };
    }

    QUnit.test('`_.' + methodName + '` should check if `object` conforms to `source`', function(assert) {
      assert.expect(2);

      var objects = [
        { 'a': 1, 'b': 8 },
        { 'a': 2, 'b': 4 },
        { 'a': 3, 'b': 16 }
      ];

      var par = conforms({
        'b': function(value) { return value > 4; }
      });

      var actual = lodashStable.filter(objects, par);
      assert.deepEqual(actual, [objects[0], objects[2]]);

      par = conforms({
        'b': function(value) { return value > 8; },
        'a': function(value) { return value > 1; }
      });

      actual = lodashStable.filter(objects, par);
      assert.deepEqual(actual, [objects[2]]);
    });

    QUnit.test('`_.' + methodName + '` should not match by inherited `source` properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = function(value) {
          return value > 1;
        };
      }
      Foo.prototype.b = function(value) {
        return value > 8;
      };

      var objects = [
        { 'a': 1, 'b': 8 },
        { 'a': 2, 'b': 4 },
        { 'a': 3, 'b': 16 }
      ];

      var par = conforms(new Foo),
          actual = lodashStable.filter(objects, par);

      assert.deepEqual(actual, [objects[1], objects[2]]);
    });

    QUnit.test('`_.' + methodName + '` should not invoke `source` predicates for missing `object` properties', function(assert) {
      assert.expect(2);

      var count = 0;

      var par = conforms({
        'a': function() { count++; return true; }
      });

      assert.strictEqual(par({}), false);
      assert.strictEqual(count, 0);
    });

    QUnit.test('`_.' + methodName + '` should work with a function for `object`', function(assert) {
      assert.expect(2);

      function Foo() {}
      Foo.a = 1;

      function Bar() {}
      Bar.a = 2;

      var par = conforms({
        'a': function(value) { return value > 1; }
      });

      assert.strictEqual(par(Foo), false);
      assert.strictEqual(par(Bar), true);
    });

    QUnit.test('`_.' + methodName + '` should work with a function for `source`', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.a = function(value) { return value > 1; };

      var objects = [{ 'a': 1 }, { 'a': 2 }],
          actual = lodashStable.filter(objects, conforms(Foo));

      assert.deepEqual(actual, [objects[1]]);
    });

    QUnit.test('`_.' + methodName + '` should work with a non-plain `object`', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var par = conforms({
        'b': function(value) { return value > 1; }
      });

      assert.strictEqual(par(new Foo), true);
    });

    QUnit.test('`_.' + methodName + '` should return `false` when `object` is nullish', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubFalse);

      var par = conforms({
        'a': function(value) { return value > 1; }
      });

      var actual = lodashStable.map(values, function(value, index) {
        try {
          return index ? par(value) : par();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return `true` when comparing an empty `source` to a nullish `object`', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubTrue),
          par = conforms({});

      var actual = lodashStable.map(values, function(value, index) {
        try {
          return index ? par(value) : par();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return `true` when comparing an empty `source`', function(assert) {
      assert.expect(1);

      var object = { 'a': 1 },
          expected = lodashStable.map(empties, stubTrue);

      var actual = lodashStable.map(empties, function(value) {
        var par = conforms(value);
        return par(object);
      });

      assert.deepEqual(actual, expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.constant');

  (function() {
    QUnit.test('should create a function that returns `value`', function(assert) {
      assert.expect(1);

      var object = { 'a': 1 },
          values = Array(2).concat(empties, true, 1, 'a'),
          constant = _.constant(object);

      var results = lodashStable.map(values, function(value, index) {
        if (index < 2) {
          return index ? constant.call({}) : constant();
        }
        return constant(value);
      });

      assert.ok(lodashStable.every(results, function(result) {
        return result === object;
      }));
    });

    QUnit.test('should work with falsey values', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubTrue);

      var actual = lodashStable.map(falsey, function(value, index) {
        var constant = index ? _.constant(value) : _.constant(),
            result = constant();

        return (result === value) || (result !== result && value !== value);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _(true).constant();
        assert.ok(wrapped instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.countBy');

  (function() {
    var array = [6.1, 4.2, 6.3];

    QUnit.test('should transform keys by `iteratee`', function(assert) {
      assert.expect(1);

      var actual = _.countBy(array, Math.floor);
      assert.deepEqual(actual, { '4': 1, '6': 2 });
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var array = [4, 6, 6],
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant({ '4': 1, '6':  2 }));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.countBy(array, value) : _.countBy(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var actual = _.countBy(['one', 'two', 'three'], 'length');
      assert.deepEqual(actual, { '3': 2, '5': 1 });
    });

    QUnit.test('should only add values to own, not inherited, properties', function(assert) {
      assert.expect(2);

      var actual = _.countBy(array, function(n) {
        return Math.floor(n) > 4 ? 'hasOwnProperty' : 'constructor';
      });

      assert.deepEqual(actual.constructor, 1);
      assert.deepEqual(actual.hasOwnProperty, 2);
    });

    QUnit.test('should work with a number for `iteratee`', function(assert) {
      assert.expect(2);

      var array = [
        [1, 'a'],
        [2, 'a'],
        [2, 'b']
      ];

      assert.deepEqual(_.countBy(array, 0), { '1': 1, '2': 2 });
      assert.deepEqual(_.countBy(array, 1), { 'a': 2, 'b': 1 });
    });

    QUnit.test('should work with an object for `collection`', function(assert) {
      assert.expect(1);

      var actual = _.countBy({ 'a': 6.1, 'b': 4.2, 'c': 6.3 }, Math.floor);
      assert.deepEqual(actual, { '4': 1, '6': 2 });
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE).concat(
          lodashStable.range(Math.floor(LARGE_ARRAY_SIZE / 2), LARGE_ARRAY_SIZE),
          lodashStable.range(Math.floor(LARGE_ARRAY_SIZE / 1.5), LARGE_ARRAY_SIZE)
        );

        var actual = _(array).countBy().map(square).filter(isEven).take().value();

        assert.deepEqual(actual, _.take(_.filter(_.map(_.countBy(array), square), isEven)));
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.create');

  (function() {
    function Shape() {
      this.x = 0;
      this.y = 0;
    }

    function Circle() {
      Shape.call(this);
    }

    QUnit.test('should create an object that inherits from the given `prototype` object', function(assert) {
      assert.expect(3);

      Circle.prototype = _.create(Shape.prototype);
      Circle.prototype.constructor = Circle;

      var actual = new Circle;

      assert.ok(actual instanceof Circle);
      assert.ok(actual instanceof Shape);
      assert.notStrictEqual(Circle.prototype, Shape.prototype);
    });

    QUnit.test('should assign `properties` to the created object', function(assert) {
      assert.expect(3);

      var expected = { 'constructor': Circle, 'radius': 0 };
      Circle.prototype = _.create(Shape.prototype, expected);

      var actual = new Circle;

      assert.ok(actual instanceof Circle);
      assert.ok(actual instanceof Shape);
      assert.deepEqual(Circle.prototype, expected);
    });

    QUnit.test('should assign own properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
        this.c = 3;
      }
      Foo.prototype.b = 2;

      assert.deepEqual(_.create({}, new Foo), { 'a': 1, 'c': 3 });
    });

    QUnit.test('should assign properties that shadow those of `prototype`', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      var object = _.create(new Foo, { 'a': 1 });
      assert.deepEqual(lodashStable.keys(object), ['a']);
    });

    QUnit.test('should accept a falsey `prototype` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubObject);

      var actual = lodashStable.map(falsey, function(prototype, index) {
        return index ? _.create(prototype) : _.create();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should ignore primitive `prototype` arguments and use an empty object instead', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(primitives, stubTrue);

      var actual = lodashStable.map(primitives, function(value, index) {
        return lodashStable.isPlainObject(index ? _.create(value) : _.create());
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [{ 'a': 1 }, { 'a': 1 }, { 'a': 1 }],
          expected = lodashStable.map(array, stubTrue),
          objects = lodashStable.map(array, _.create);

      var actual = lodashStable.map(objects, function(object) {
        return object.a === 1 && !_.keys(object).length;
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.curry');

  (function() {
    function fn(a, b, c, d) {
      return slice.call(arguments);
    }

    QUnit.test('should curry based on the number of arguments given', function(assert) {
      assert.expect(3);

      var curried = _.curry(fn),
          expected = [1, 2, 3, 4];

      assert.deepEqual(curried(1)(2)(3)(4), expected);
      assert.deepEqual(curried(1, 2)(3, 4), expected);
      assert.deepEqual(curried(1, 2, 3, 4), expected);
    });

    QUnit.test('should allow specifying `arity`', function(assert) {
      assert.expect(3);

      var curried = _.curry(fn, 3),
          expected = [1, 2, 3];

      assert.deepEqual(curried(1)(2, 3), expected);
      assert.deepEqual(curried(1, 2)(3), expected);
      assert.deepEqual(curried(1, 2, 3), expected);
    });

    QUnit.test('should coerce `arity` to an integer', function(assert) {
      assert.expect(2);

      var values = ['0', 0.6, 'xyz'],
          expected = lodashStable.map(values, stubArray);

      var actual = lodashStable.map(values, function(arity) {
        return _.curry(fn, arity)();
      });

      assert.deepEqual(actual, expected);
      assert.deepEqual(_.curry(fn, '2')(1)(2), [1, 2]);
    });

    QUnit.test('should support placeholders', function(assert) {
      assert.expect(4);

      var curried = _.curry(fn),
          ph = curried.placeholder;

      assert.deepEqual(curried(1)(ph, 3)(ph, 4)(2), [1, 2, 3, 4]);
      assert.deepEqual(curried(ph, 2)(1)(ph, 4)(3), [1, 2, 3, 4]);
      assert.deepEqual(curried(ph, ph, 3)(ph, 2)(ph, 4)(1), [1, 2, 3, 4]);
      assert.deepEqual(curried(ph, ph, ph, 4)(ph, ph, 3)(ph, 2)(1), [1, 2, 3, 4]);
    });

    QUnit.test('should persist placeholders', function(assert) {
      assert.expect(1);

      var curried = _.curry(fn),
          ph = curried.placeholder,
          actual = curried(ph, ph, ph, 'd')('a')(ph)('b')('c');

      assert.deepEqual(actual, ['a', 'b', 'c', 'd']);
    });

    QUnit.test('should use `_.placeholder` when set', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var curried = _.curry(fn),
            _ph = _.placeholder = {},
            ph = curried.placeholder;

        assert.deepEqual(curried(1)(_ph, 3)(ph, 4), [1, ph, 3, 4]);
        delete _.placeholder;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should provide additional arguments after reaching the target arity', function(assert) {
      assert.expect(3);

      var curried = _.curry(fn, 3);
      assert.deepEqual(curried(1)(2, 3, 4), [1, 2, 3, 4]);
      assert.deepEqual(curried(1, 2)(3, 4, 5), [1, 2, 3, 4, 5]);
      assert.deepEqual(curried(1, 2, 3, 4, 5, 6), [1, 2, 3, 4, 5, 6]);
    });

    QUnit.test('should create a function with a `length` of `0`', function(assert) {
      assert.expect(6);

      lodashStable.times(2, function(index) {
        var curried = index ? _.curry(fn, 4) : _.curry(fn);
        assert.strictEqual(curried.length, 0);
        assert.strictEqual(curried(1).length, 0);
        assert.strictEqual(curried(1, 2).length, 0);
      });
    });

    QUnit.test('should ensure `new curried` is an instance of `func`', function(assert) {
      assert.expect(2);

      function Foo(value) {
        return value && object;
      }

      var curried = _.curry(Foo),
          object = {};

      assert.ok(new curried(false) instanceof Foo);
      assert.strictEqual(new curried(true), object);
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(9);

      var fn = function(a, b, c) {
        var value = this || {};
        return [value[a], value[b], value[c]];
      };

      var object = { 'a': 1, 'b': 2, 'c': 3 },
          expected = [1, 2, 3];

      assert.deepEqual(_.curry(_.bind(fn, object), 3)('a')('b')('c'), expected);
      assert.deepEqual(_.curry(_.bind(fn, object), 3)('a', 'b')('c'), expected);
      assert.deepEqual(_.curry(_.bind(fn, object), 3)('a', 'b', 'c'), expected);

      assert.deepEqual(_.bind(_.curry(fn), object)('a')('b')('c'), Array(3));
      assert.deepEqual(_.bind(_.curry(fn), object)('a', 'b')('c'), Array(3));
      assert.deepEqual(_.bind(_.curry(fn), object)('a', 'b', 'c'), expected);

      object.curried = _.curry(fn);
      assert.deepEqual(object.curried('a')('b')('c'), Array(3));
      assert.deepEqual(object.curried('a', 'b')('c'), Array(3));
      assert.deepEqual(object.curried('a', 'b', 'c'), expected);
    });

    QUnit.test('should work with partialed methods', function(assert) {
      assert.expect(2);

      var curried = _.curry(fn),
          expected = [1, 2, 3, 4];

      var a = _.partial(curried, 1),
          b = _.bind(a, null, 2),
          c = _.partialRight(b, 4),
          d = _.partialRight(b(3), 4);

      assert.deepEqual(c(3), expected);
      assert.deepEqual(d(), expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.curryRight');

  (function() {
    function fn(a, b, c, d) {
      return slice.call(arguments);
    }

    QUnit.test('should curry based on the number of arguments given', function(assert) {
      assert.expect(3);

      var curried = _.curryRight(fn),
          expected = [1, 2, 3, 4];

      assert.deepEqual(curried(4)(3)(2)(1), expected);
      assert.deepEqual(curried(3, 4)(1, 2), expected);
      assert.deepEqual(curried(1, 2, 3, 4), expected);
    });

    QUnit.test('should allow specifying `arity`', function(assert) {
      assert.expect(3);

      var curried = _.curryRight(fn, 3),
          expected = [1, 2, 3];

      assert.deepEqual(curried(3)(1, 2), expected);
      assert.deepEqual(curried(2, 3)(1), expected);
      assert.deepEqual(curried(1, 2, 3), expected);
    });

    QUnit.test('should coerce `arity` to an integer', function(assert) {
      assert.expect(2);

      var values = ['0', 0.6, 'xyz'],
          expected = lodashStable.map(values, stubArray);

      var actual = lodashStable.map(values, function(arity) {
        return _.curryRight(fn, arity)();
      });

      assert.deepEqual(actual, expected);
      assert.deepEqual(_.curryRight(fn, '2')(1)(2), [2, 1]);
    });

    QUnit.test('should support placeholders', function(assert) {
      assert.expect(4);

      var curried = _.curryRight(fn),
          expected = [1, 2, 3, 4],
          ph = curried.placeholder;

      assert.deepEqual(curried(4)(2, ph)(1, ph)(3), expected);
      assert.deepEqual(curried(3, ph)(4)(1, ph)(2), expected);
      assert.deepEqual(curried(ph, ph, 4)(ph, 3)(ph, 2)(1), expected);
      assert.deepEqual(curried(ph, ph, ph, 4)(ph, ph, 3)(ph, 2)(1), expected);
    });

    QUnit.test('should persist placeholders', function(assert) {
      assert.expect(1);

      var curried = _.curryRight(fn),
          ph = curried.placeholder,
          actual = curried('a', ph, ph, ph)('b')(ph)('c')('d');

      assert.deepEqual(actual, ['a', 'b', 'c', 'd']);
    });

    QUnit.test('should use `_.placeholder` when set', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var curried = _.curryRight(fn),
            _ph = _.placeholder = {},
            ph = curried.placeholder;

        assert.deepEqual(curried(4)(2, _ph)(1, ph), [1, 2, ph, 4]);
        delete _.placeholder;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should provide additional arguments after reaching the target arity', function(assert) {
      assert.expect(3);

      var curried = _.curryRight(fn, 3);
      assert.deepEqual(curried(4)(1, 2, 3), [1, 2, 3, 4]);
      assert.deepEqual(curried(4, 5)(1, 2, 3), [1, 2, 3, 4, 5]);
      assert.deepEqual(curried(1, 2, 3, 4, 5, 6), [1, 2, 3, 4, 5, 6]);
    });

    QUnit.test('should create a function with a `length` of `0`', function(assert) {
      assert.expect(6);

      lodashStable.times(2, function(index) {
        var curried = index ? _.curryRight(fn, 4) : _.curryRight(fn);
        assert.strictEqual(curried.length, 0);
        assert.strictEqual(curried(4).length, 0);
        assert.strictEqual(curried(3, 4).length, 0);
      });
    });

    QUnit.test('should ensure `new curried` is an instance of `func`', function(assert) {
      assert.expect(2);

      function Foo(value) {
        return value && object;
      }

      var curried = _.curryRight(Foo),
          object = {};

      assert.ok(new curried(false) instanceof Foo);
      assert.strictEqual(new curried(true), object);
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(9);

      var fn = function(a, b, c) {
        var value = this || {};
        return [value[a], value[b], value[c]];
      };

      var object = { 'a': 1, 'b': 2, 'c': 3 },
          expected = [1, 2, 3];

      assert.deepEqual(_.curryRight(_.bind(fn, object), 3)('c')('b')('a'), expected);
      assert.deepEqual(_.curryRight(_.bind(fn, object), 3)('b', 'c')('a'), expected);
      assert.deepEqual(_.curryRight(_.bind(fn, object), 3)('a', 'b', 'c'), expected);

      assert.deepEqual(_.bind(_.curryRight(fn), object)('c')('b')('a'), Array(3));
      assert.deepEqual(_.bind(_.curryRight(fn), object)('b', 'c')('a'), Array(3));
      assert.deepEqual(_.bind(_.curryRight(fn), object)('a', 'b', 'c'), expected);

      object.curried = _.curryRight(fn);
      assert.deepEqual(object.curried('c')('b')('a'), Array(3));
      assert.deepEqual(object.curried('b', 'c')('a'), Array(3));
      assert.deepEqual(object.curried('a', 'b', 'c'), expected);
    });

    QUnit.test('should work with partialed methods', function(assert) {
      assert.expect(2);

      var curried = _.curryRight(fn),
          expected = [1, 2, 3, 4];

      var a = _.partialRight(curried, 4),
          b = _.partialRight(a, 3),
          c = _.bind(b, null, 1),
          d = _.partial(b(2), 1);

      assert.deepEqual(c(2), expected);
      assert.deepEqual(d(), expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('curry methods');

  lodashStable.each(['curry', 'curryRight'], function(methodName) {
    var func = _[methodName],
        fn = function(a, b) { return slice.call(arguments); },
        isCurry = methodName == 'curry';

    QUnit.test('`_.' + methodName + '` should not error on functions with the same name as lodash methods', function(assert) {
      assert.expect(1);

      function run(a, b) {
        return a + b;
      }

      var curried = func(run);

      try {
        var actual = curried(1)(2);
      } catch (e) {}

      assert.strictEqual(actual, 3);
    });

    QUnit.test('`_.' + methodName + '` should work for function names that shadow those on `Object.prototype`', function(assert) {
      assert.expect(1);

      var curried = _.curry(function hasOwnProperty(a, b, c) {
        return [a, b, c];
      });

      var expected = [1, 2, 3];

      assert.deepEqual(curried(1)(2)(3), expected);
    });

    QUnit.test('`_.' + methodName + '` should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(2);

      var array = [fn, fn, fn],
          object = { 'a': fn, 'b': fn, 'c': fn };

      lodashStable.each([array, object], function(collection) {
        var curries = lodashStable.map(collection, func),
            expected = lodashStable.map(collection, lodashStable.constant(isCurry ? ['a', 'b'] : ['b', 'a']));

        var actual = lodashStable.map(curries, function(curried) {
          return curried('a')('b');
        });

        assert.deepEqual(actual, expected);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.debounce');

  (function() {
    QUnit.test('should debounce a function', function(assert) {
      assert.expect(6);

      var done = assert.async();

      var callCount = 0;

      var debounced = _.debounce(function(value) {
        ++callCount;
        return value;
      }, 32);

      var results = [debounced('a'), debounced('b'), debounced('c')];
      assert.deepEqual(results, [undefined, undefined, undefined]);
      assert.strictEqual(callCount, 0);

      setTimeout(function() {
        assert.strictEqual(callCount, 1);

        var results = [debounced('d'), debounced('e'), debounced('f')];
        assert.deepEqual(results, ['c', 'c', 'c']);
        assert.strictEqual(callCount, 1);
      }, 128);

      setTimeout(function() {
        assert.strictEqual(callCount, 2);
        done();
      }, 256);
    });

    QUnit.test('subsequent debounced calls return the last `func` result', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var debounced = _.debounce(identity, 32);
      debounced('a');

      setTimeout(function() {
        assert.notEqual(debounced('b'), 'b');
      }, 64);

      setTimeout(function() {
        assert.notEqual(debounced('c'), 'c');
        done();
      }, 128);
    });

    QUnit.test('should not immediately call `func` when `wait` is `0`', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0,
          debounced = _.debounce(function() { ++callCount; }, 0);

      debounced();
      debounced();
      assert.strictEqual(callCount, 0);

      setTimeout(function() {
        assert.strictEqual(callCount, 1);
        done();
      }, 5);
    });

    QUnit.test('should apply default options', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0,
          debounced = _.debounce(function() { callCount++; }, 32, {});

      debounced();
      assert.strictEqual(callCount, 0);

      setTimeout(function() {
        assert.strictEqual(callCount, 1);
        done();
      }, 64);
    });

    QUnit.test('should support a `leading` option', function(assert) {
      assert.expect(4);

      var done = assert.async();

      var callCounts = [0, 0];

      var withLeading = _.debounce(function() {
        callCounts[0]++;
      }, 32, { 'leading': true });

      var withLeadingAndTrailing = _.debounce(function() {
        callCounts[1]++;
      }, 32, { 'leading': true });

      withLeading();
      assert.strictEqual(callCounts[0], 1);

      withLeadingAndTrailing();
      withLeadingAndTrailing();
      assert.strictEqual(callCounts[1], 1);

      setTimeout(function() {
        assert.deepEqual(callCounts, [1, 2]);

        withLeading();
        assert.strictEqual(callCounts[0], 2);

        done();
      }, 64);
    });

    QUnit.test('subsequent leading debounced calls return the last `func` result', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var debounced = _.debounce(identity, 32, { 'leading': true, 'trailing': false }),
          results = [debounced('a'), debounced('b')];

      assert.deepEqual(results, ['a', 'a']);

      setTimeout(function() {
        var results = [debounced('c'), debounced('d')];
        assert.deepEqual(results, ['c', 'c']);
        done();
      }, 64);
    });

    QUnit.test('should support a `trailing` option', function(assert) {
      assert.expect(4);

      var done = assert.async();

      var withCount = 0,
          withoutCount = 0;

      var withTrailing = _.debounce(function() {
        withCount++;
      }, 32, { 'trailing': true });

      var withoutTrailing = _.debounce(function() {
        withoutCount++;
      }, 32, { 'trailing': false });

      withTrailing();
      assert.strictEqual(withCount, 0);

      withoutTrailing();
      assert.strictEqual(withoutCount, 0);

      setTimeout(function() {
        assert.strictEqual(withCount, 1);
        assert.strictEqual(withoutCount, 0);
        done();
      }, 64);
    });

    QUnit.test('should support a `maxWait` option', function(assert) {
      assert.expect(4);

      var done = assert.async();

      var callCount = 0;

      var debounced = _.debounce(function(value) {
        ++callCount;
        return value;
      }, 32, { 'maxWait': 64 });

      debounced();
      debounced();
      assert.strictEqual(callCount, 0);

      setTimeout(function() {
        assert.strictEqual(callCount, 1);
        debounced();
        debounced();
        assert.strictEqual(callCount, 1);
      }, 128);

      setTimeout(function() {
        assert.strictEqual(callCount, 2);
        done();
      }, 256);
    });

    QUnit.test('should support `maxWait` in a tight loop', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var limit = (argv || isPhantom) ? 1000 : 320,
          withCount = 0,
          withoutCount = 0;

      var withMaxWait = _.debounce(function() {
        withCount++;
      }, 64, { 'maxWait': 128 });

      var withoutMaxWait = _.debounce(function() {
        withoutCount++;
      }, 96);

      var start = +new Date;
      while ((new Date - start) < limit) {
        withMaxWait();
        withoutMaxWait();
      }
      var actual = [Boolean(withoutCount), Boolean(withCount)];
      setTimeout(function() {
        assert.deepEqual(actual, [false, true]);
        done();
      }, 1);
    });

    QUnit.test('should queue a trailing call for subsequent debounced calls after `maxWait`', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var callCount = 0;

      var debounced = _.debounce(function() {
        ++callCount;
      }, 200, { 'maxWait': 200 });

      debounced();

      setTimeout(debounced, 190);
      setTimeout(debounced, 200);
      setTimeout(debounced, 210);

      setTimeout(function() {
        assert.strictEqual(callCount, 2);
        done();
      }, 500);
    });

    QUnit.test('should cancel `maxDelayed` when `delayed` is invoked', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0;

      var debounced = _.debounce(function() {
        callCount++;
      }, 32, { 'maxWait': 64 });

      debounced();

      setTimeout(function() {
        debounced();
        assert.strictEqual(callCount, 1);
      }, 128);

      setTimeout(function() {
        assert.strictEqual(callCount, 2);
        done();
      }, 192);
    });

    QUnit.test('should invoke the trailing call with the correct arguments and `this` binding', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var actual,
          callCount = 0,
          object = {};

      var debounced = _.debounce(function(value) {
        actual = [this];
        push.apply(actual, arguments);
        return ++callCount != 2;
      }, 32, { 'leading': true, 'maxWait': 64 });

      while (true) {
        if (!debounced.call(object, 'a')) {
          break;
        }
      }
      setTimeout(function() {
        assert.strictEqual(callCount, 2);
        assert.deepEqual(actual, [object, 'a']);
        done();
      }, 64);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.deburr');

  (function() {
    QUnit.test('should convert Latin-1 Supplement letters to basic Latin', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(burredLetters, _.deburr);
      assert.deepEqual(actual, deburredLetters);
    });

    QUnit.test('should not deburr Latin mathematical operators', function(assert) {
      assert.expect(1);

      var operators = ['\xd7', '\xf7'],
          actual = lodashStable.map(operators, _.deburr);

      assert.deepEqual(actual, operators);
    });

    QUnit.test('should deburr combining diacritical marks', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(comboMarks, lodashStable.constant('ei'));

      var actual = lodashStable.map(comboMarks, function(chr) {
        return _.deburr('e' + chr + 'i');
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.defaults');

  (function() {
    QUnit.test('should assign source properties if missing on `object`', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.defaults({ 'a': 1 }, { 'a': 2, 'b': 2 }), { 'a': 1, 'b': 2 });
    });

    QUnit.test('should accept multiple sources', function(assert) {
      assert.expect(2);

      var expected = { 'a': 1, 'b': 2, 'c': 3 };
      assert.deepEqual(_.defaults({ 'a': 1, 'b': 2 }, { 'b': 3 }, { 'c': 3 }), expected);
      assert.deepEqual(_.defaults({ 'a': 1, 'b': 2 }, { 'b': 3, 'c': 3 }, { 'c': 2 }), expected);
    });

    QUnit.test('should not overwrite `null` values', function(assert) {
      assert.expect(1);

      var actual = _.defaults({ 'a': null }, { 'a': 1 });
      assert.strictEqual(actual.a, null);
    });

    QUnit.test('should overwrite `undefined` values', function(assert) {
      assert.expect(1);

      var actual = _.defaults({ 'a': undefined }, { 'a': 1 });
      assert.strictEqual(actual.a, 1);
    });

    QUnit.test('should assign properties that shadow those on `Object.prototype`', function(assert) {
      assert.expect(2);

      var object = {
        'constructor': objectProto.constructor,
        'hasOwnProperty': objectProto.hasOwnProperty,
        'isPrototypeOf': objectProto.isPrototypeOf,
        'propertyIsEnumerable': objectProto.propertyIsEnumerable,
        'toLocaleString': objectProto.toLocaleString,
        'toString': objectProto.toString,
        'valueOf': objectProto.valueOf
      };

      var source = {
        'constructor': 1,
        'hasOwnProperty': 2,
        'isPrototypeOf': 3,
        'propertyIsEnumerable': 4,
        'toLocaleString': 5,
        'toString': 6,
        'valueOf': 7
      };

      assert.deepEqual(_.defaults({}, source), source);
      assert.deepEqual(_.defaults({}, object, source), object);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.defaultsDeep');

  (function() {
    QUnit.test('should deep assign source properties if missing on `object`', function(assert) {
      assert.expect(1);

      var object = { 'a': { 'b': 2 }, 'd': 4 },
          source = { 'a': { 'b': 3, 'c': 3 }, 'e': 5 },
          expected = { 'a': { 'b': 2, 'c': 3 }, 'd': 4, 'e': 5 };

      assert.deepEqual(_.defaultsDeep(object, source), expected);
    });

    QUnit.test('should accept multiple sources', function(assert) {
      assert.expect(2);

      var source1 = { 'a': { 'b': 3 } },
          source2 = { 'a': { 'c': 3 } },
          source3 = { 'a': { 'b': 3, 'c': 3 } },
          source4 = { 'a': { 'c': 4 } },
          expected = { 'a': { 'b': 2, 'c': 3 } };

      assert.deepEqual(_.defaultsDeep({ 'a': { 'b': 2 } }, source1, source2), expected);
      assert.deepEqual(_.defaultsDeep({ 'a': { 'b': 2 } }, source3, source4), expected);
    });

    QUnit.test('should not overwrite `null` values', function(assert) {
      assert.expect(1);

      var object = { 'a': { 'b': null } },
          source = { 'a': { 'b': 2 } },
          actual = _.defaultsDeep(object, source);

      assert.strictEqual(actual.a.b, null);
    });

    QUnit.test('should not overwrite regexp values', function(assert) {
      assert.expect(1);

      var object = { 'a': { 'b': /x/ } },
          source = { 'a': { 'b': /y/ } },
          actual = _.defaultsDeep(object, source);

      assert.deepEqual(actual.a.b, /x/);
    });

    QUnit.test('should not convert function properties to objects', function(assert) {
      assert.expect(2);

      var actual = _.defaultsDeep({}, { 'a': noop });
      assert.strictEqual(actual.a, noop);

      actual = _.defaultsDeep({}, { 'a': { 'b': noop } });
      assert.strictEqual(actual.a.b, noop);
    });

    QUnit.test('should overwrite `undefined` values', function(assert) {
      assert.expect(1);

      var object = { 'a': { 'b': undefined } },
          source = { 'a': { 'b': 2 } },
          actual = _.defaultsDeep(object, source);

      assert.strictEqual(actual.a.b, 2);
    });

    QUnit.test('should merge sources containing circular references', function(assert) {
      assert.expect(2);

      var object = {
        'foo': { 'b': { 'c': { 'd': {} } } },
        'bar': { 'a': 2 }
      };

      var source = {
        'foo': { 'b': { 'c': { 'd': {} } } },
        'bar': {}
      };

      object.foo.b.c.d = object;
      source.foo.b.c.d = source;
      source.bar.b = source.foo.b;

      var actual = _.defaultsDeep(object, source);

      assert.strictEqual(actual.bar.b, actual.foo.b);
      assert.strictEqual(actual.foo.b.c.d, actual.foo.b.c.d.foo.b.c.d);
    });

    QUnit.test('should not modify sources', function(assert) {
      assert.expect(3);

      var source1 = { 'a': 1, 'b': { 'c': 2 } },
          source2 = { 'b': { 'c': 3, 'd': 3 } },
          actual = _.defaultsDeep({}, source1, source2);

      assert.deepEqual(actual, { 'a': 1, 'b': { 'c': 2, 'd': 3 } });
      assert.deepEqual(source1, { 'a': 1, 'b': { 'c': 2 } });
      assert.deepEqual(source2, { 'b': { 'c': 3, 'd': 3 } });
    });

    QUnit.test('should not attempt a merge of a string into an array', function(assert) {
      assert.expect(1);

      var actual = _.defaultsDeep({ 'a': ['abc'] }, { 'a': 'abc' });
      assert.deepEqual(actual, { 'a': ['abc'] });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.defaultTo');

  (function() {
    QUnit.test('should return a default value if `value` is `NaN` or nullish', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return (value == null || value !== value) ? 1 : value;
      });

      var actual = lodashStable.map(falsey, function(value) {
        return _.defaultTo(value, 1);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.defer');

  (function() {
    QUnit.test('should defer `func` execution', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var pass = false;
      _.defer(function() { pass = true; });

      setTimeout(function() {
        assert.ok(pass);
        done();
      }, 32);
    });

    QUnit.test('should provide additional arguments to `func`', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var args;

      _.defer(function() {
        args = slice.call(arguments);
      }, 1, 2);

      setTimeout(function() {
        assert.deepEqual(args, [1, 2]);
        done();
      }, 32);
    });

    QUnit.test('should be cancelable', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var pass = true,
          timerId = _.defer(function() { pass = false; });

      clearTimeout(timerId);

      setTimeout(function() {
        assert.ok(pass);
        done();
      }, 32);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.delay');

  (function() {
    QUnit.test('should delay `func` execution', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var pass = false;
      _.delay(function() { pass = true; }, 32);

      setTimeout(function() {
        assert.notOk(pass);
      }, 1);

      setTimeout(function() {
        assert.ok(pass);
        done();
      }, 64);
    });

    QUnit.test('should provide additional arguments to `func`', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var args;

      _.delay(function() {
        args = slice.call(arguments);
      }, 32, 1, 2);

      setTimeout(function() {
        assert.deepEqual(args, [1, 2]);
        done();
      }, 64);
    });

    QUnit.test('should use a default `wait` of `0`', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var pass = false;
      _.delay(function() { pass = true; });

      assert.notOk(pass);

      setTimeout(function() {
        assert.ok(pass);
        done();
      }, 0);
    });

    QUnit.test('should be cancelable', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var pass = true,
          timerId = _.delay(function() { pass = false; }, 32);

      clearTimeout(timerId);

      setTimeout(function() {
        assert.ok(pass);
        done();
      }, 64);
    });

    QUnit.test('should work with mocked `setTimeout`', function(assert) {
      assert.expect(1);

      if (!isPhantom) {
        var pass = false,
            setTimeout = root.setTimeout;

        setProperty(root, 'setTimeout', function(func) { func(); });
        _.delay(function() { pass = true; }, 32);
        setProperty(root, 'setTimeout', setTimeout);

        assert.ok(pass);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('difference methods');

  lodashStable.each(['difference', 'differenceBy', 'differenceWith'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        func = _[methodName];

    QUnit.test('`_.' + methodName + '` should return the difference of two arrays', function(assert) {
      assert.expect(1);

      var actual = func([2, 1], [2, 3]);
      assert.deepEqual(actual, [1]);
    });

    QUnit.test('`_.' + methodName + '` should return the difference of multiple arrays', function(assert) {
      assert.expect(1);

      var actual = func([2, 1, 2, 3], [3, 4], [3, 2]);
      assert.deepEqual(actual, [1]);
    });

    QUnit.test('`_.' + methodName + '` should treat `-0` as `0`', function(assert) {
      assert.expect(2);

      var array = [-0, 0];

      var actual = lodashStable.map(array, function(value) {
        return func(array, [value]);
      });

      assert.deepEqual(actual, [[], []]);

      actual = lodashStable.map(func([-0, 1], [1]), lodashStable.toString);
      assert.deepEqual(actual, ['0']);
    });

    QUnit.test('`_.' + methodName + '` should match `NaN`', function(assert) {
      assert.expect(1);

      assert.deepEqual(func([1, NaN, 3], [NaN, 5, NaN]), [1, 3]);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays', function(assert) {
      assert.expect(1);

      var array1 = lodashStable.range(LARGE_ARRAY_SIZE + 1),
          array2 = lodashStable.range(LARGE_ARRAY_SIZE),
          a = {},
          b = {},
          c = {};

      array1.push(a, b, c);
      array2.push(b, c, a);

      assert.deepEqual(func(array1, array2), [LARGE_ARRAY_SIZE]);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of `-0` as `0`', function(assert) {
      assert.expect(2);

      var array = [-0, 0];

      var actual = lodashStable.map(array, function(value) {
        var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, lodashStable.constant(value));
        return func(array, largeArray);
      });

      assert.deepEqual(actual, [[], []]);

      var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, stubOne);
      actual = lodashStable.map(func([-0, 1], largeArray), lodashStable.toString);
      assert.deepEqual(actual, ['0']);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of `NaN`', function(assert) {
      assert.expect(1);

      var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, stubNaN);
      assert.deepEqual(func([1, NaN, 3], largeArray), [1, 3]);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of objects', function(assert) {
      assert.expect(1);

      var object1 = {},
          object2 = {},
          largeArray = lodashStable.times(LARGE_ARRAY_SIZE, lodashStable.constant(object1));

      assert.deepEqual(func([object1, object2], largeArray), [object2]);
    });

    QUnit.test('`_.' + methodName + '` should ignore values that are not array-like', function(assert) {
      assert.expect(3);

      var array = [1, null, 3];

      assert.deepEqual(func(args, 3, { '0': 1 }), [1, 2, 3]);
      assert.deepEqual(func(null, array, 1), []);
      assert.deepEqual(func(array, args, null), [null]);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.differenceBy');

  (function() {
    QUnit.test('should accept an `iteratee` argument', function(assert) {
      assert.expect(2);

      var actual = _.differenceBy([2.1, 1.2], [2.3, 3.4], Math.floor);
      assert.deepEqual(actual, [1.2]);

      actual = _.differenceBy([{ 'x': 2 }, { 'x': 1 }], [{ 'x': 1 }], 'x');
      assert.deepEqual(actual, [{ 'x': 2 }]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.differenceBy([2.1, 1.2], [2.3, 3.4], function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [2.3]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.differenceWith');

  (function() {
    QUnit.test('should work with a `comparator` argument', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }],
          actual = _.differenceWith(objects, [{ 'x': 1, 'y': 2 }], lodashStable.isEqual);

      assert.deepEqual(actual, [objects[1]]);
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var array = [-0, 1],
          largeArray = lodashStable.times(LARGE_ARRAY_SIZE, stubOne),
          others = [[1], largeArray],
          expected = lodashStable.map(others, lodashStable.constant(['-0']));

      var actual = lodashStable.map(others, function(other) {
        return lodashStable.map(_.differenceWith(array, other, lodashStable.eq), lodashStable.toString);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.divide');

  (function() {
    QUnit.test('should divide two numbers', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.divide(6, 4), 1.5);
      assert.strictEqual(_.divide(-6, 4), -1.5);
      assert.strictEqual(_.divide(-6, -4), 1.5);
    });

    QUnit.test('should coerce arguments to numbers', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.divide('6', '4'), 1.5);
      assert.deepEqual(_.divide('x', 'y'), NaN);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.drop');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should drop the first two elements', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.drop(array, 2), [3]);
    });

    QUnit.test('should treat falsey `n` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? [2, 3] : array;
      });

      var actual = lodashStable.map(falsey, function(n) {
        return _.drop(array, n);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return all elements when `n` < `1`', function(assert) {
      assert.expect(3);

      lodashStable.each([0, -1, -Infinity], function(n) {
        assert.deepEqual(_.drop(array, n), array);
      });
    });

    QUnit.test('should return an empty array when `n` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(n) {
        assert.deepEqual(_.drop(array, n), []);
      });
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.drop(array, 1.6), [2, 3]);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.drop);

      assert.deepEqual(actual, [[2, 3], [5, 6], [8, 9]]);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        var array = lodashStable.range(1, LARGE_ARRAY_SIZE + 1),
            predicate = function(value) { values.push(value); return isEven(value); },
            values = [],
            actual = _(array).drop(2).drop().value();

        assert.deepEqual(actual, array.slice(3));

        actual = _(array).filter(predicate).drop(2).drop().value();
        assert.deepEqual(values, array);
        assert.deepEqual(actual, _.drop(_.drop(_.filter(array, predicate), 2)));

        actual = _(array).drop(2).dropRight().drop().dropRight(2).value();
        assert.deepEqual(actual, _.dropRight(_.drop(_.dropRight(_.drop(array, 2))), 2));

        values = [];

        actual = _(array).drop().filter(predicate).drop(2).dropRight().drop().dropRight(2).value();
        assert.deepEqual(values, array.slice(1));
        assert.deepEqual(actual, _.dropRight(_.drop(_.dropRight(_.drop(_.filter(_.drop(array), predicate), 2))), 2));
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.dropRight');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should drop the last two elements', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropRight(array, 2), [1]);
    });

    QUnit.test('should treat falsey `n` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? [1, 2] : array;
      });

      var actual = lodashStable.map(falsey, function(n) {
        return _.dropRight(array, n);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return all elements when `n` < `1`', function(assert) {
      assert.expect(3);

      lodashStable.each([0, -1, -Infinity], function(n) {
        assert.deepEqual(_.dropRight(array, n), array);
      });
    });

    QUnit.test('should return an empty array when `n` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(n) {
        assert.deepEqual(_.dropRight(array, n), []);
      });
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropRight(array, 1.6), [1, 2]);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.dropRight);

      assert.deepEqual(actual, [[1, 2], [4, 5], [7, 8]]);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        var array = lodashStable.range(1, LARGE_ARRAY_SIZE + 1),
            predicate = function(value) { values.push(value); return isEven(value); },
            values = [],
            actual = _(array).dropRight(2).dropRight().value();

        assert.deepEqual(actual, array.slice(0, -3));

        actual = _(array).filter(predicate).dropRight(2).dropRight().value();
        assert.deepEqual(values, array);
        assert.deepEqual(actual, _.dropRight(_.dropRight(_.filter(array, predicate), 2)));

        actual = _(array).dropRight(2).drop().dropRight().drop(2).value();
        assert.deepEqual(actual, _.drop(_.dropRight(_.drop(_.dropRight(array, 2))), 2));

        values = [];

        actual = _(array).dropRight().filter(predicate).dropRight(2).drop().dropRight().drop(2).value();
        assert.deepEqual(values, array.slice(0, -1));
        assert.deepEqual(actual, _.drop(_.dropRight(_.drop(_.dropRight(_.filter(_.dropRight(array), predicate), 2))), 2));
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.dropRightWhile');

  (function() {
    var array = [1, 2, 3, 4];

    var objects = [
      { 'a': 0, 'b': 0 },
      { 'a': 1, 'b': 1 },
      { 'a': 2, 'b': 2 }
    ];

    QUnit.test('should drop elements while `predicate` returns truthy', function(assert) {
      assert.expect(1);

      var actual = _.dropRightWhile(array, function(n) {
        return n > 2;
      });

      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('should provide correct `predicate` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.dropRightWhile(array, function() {
        args = slice.call(arguments);
      });

      assert.deepEqual(args, [4, 3, array]);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropRightWhile(objects, { 'b': 2 }), objects.slice(0, 2));
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropRightWhile(objects, ['b', 2]), objects.slice(0, 2));
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropRightWhile(objects, 'b'), objects.slice(0, 1));
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _(array).dropRightWhile(function(n) {
          return n > 2;
        });

        assert.ok(wrapped instanceof _);
        assert.deepEqual(wrapped.value(), [1, 2]);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.dropWhile');

  (function() {
    var array = [1, 2, 3, 4];

    var objects = [
      { 'a': 2, 'b': 2 },
      { 'a': 1, 'b': 1 },
      { 'a': 0, 'b': 0 }
    ];

    QUnit.test('should drop elements while `predicate` returns truthy', function(assert) {
      assert.expect(1);

      var actual = _.dropWhile(array, function(n) {
        return n < 3;
      });

      assert.deepEqual(actual, [3, 4]);
    });

    QUnit.test('should provide correct `predicate` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.dropWhile(array, function() {
        args = slice.call(arguments);
      });

      assert.deepEqual(args, [1, 0, array]);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropWhile(objects, { 'b': 2 }), objects.slice(1));
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropWhile(objects, ['b', 2]), objects.slice(1));
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.dropWhile(objects, 'b'), objects.slice(2));
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(3);

      if (!isNpm) {
        var array = lodashStable.range(1, LARGE_ARRAY_SIZE + 3),
            predicate = function(n) { return n < 3; },
            expected = _.dropWhile(array, predicate),
            wrapped = _(array).dropWhile(predicate);

        assert.deepEqual(wrapped.value(), expected);
        assert.deepEqual(wrapped.reverse().value(), expected.slice().reverse());
        assert.strictEqual(wrapped.last(), _.last(expected));
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should work in a lazy sequence with `drop`', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array = lodashStable.range(1, LARGE_ARRAY_SIZE + 3);

        var actual = _(array)
          .dropWhile(function(n) { return n == 1; })
          .drop()
          .dropWhile(function(n) { return n == 3; })
          .value();

        assert.deepEqual(actual, array.slice(3));
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.endsWith');

  (function() {
    var string = 'abc';

    QUnit.test('should return `true` if a string ends with `target`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.endsWith(string, 'c'), true);
    });

    QUnit.test('should return `false` if a string does not end with `target`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.endsWith(string, 'b'), false);
    });

    QUnit.test('should work with a `position` argument', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.endsWith(string, 'b', 2), true);
    });

    QUnit.test('should work with `position` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 5, MAX_SAFE_INTEGER, Infinity], function(position) {
        assert.strictEqual(_.endsWith(string, 'c', position), true);
      });
    });

    QUnit.test('should treat falsey `position` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubTrue);

      var actual = lodashStable.map(falsey, function(position) {
        return _.endsWith(string, position === undefined ? 'c' : '', position);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should treat a negative `position` as `0`', function(assert) {
      assert.expect(6);

      lodashStable.each([-1, -3, -Infinity], function(position) {
        assert.ok(lodashStable.every(string, function(chr) {
          return !_.endsWith(string, chr, position);
        }));
        assert.strictEqual(_.endsWith(string, '', position), true);
      });
    });

    QUnit.test('should coerce `position` to an integer', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.endsWith(string, 'ab', 2.2), true);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.eq');

  (function() {
    QUnit.test('should perform a `SameValueZero` comparison of two values', function(assert) {
      assert.expect(11);

      assert.strictEqual(_.eq(), true);
      assert.strictEqual(_.eq(undefined), true);
      assert.strictEqual(_.eq(0, -0), true);
      assert.strictEqual(_.eq(NaN, NaN), true);
      assert.strictEqual(_.eq(1, 1), true);

      assert.strictEqual(_.eq(null, undefined), false);
      assert.strictEqual(_.eq(1, Object(1)), false);
      assert.strictEqual(_.eq(1, '1'), false);
      assert.strictEqual(_.eq(1, '1'), false);

      var object = { 'a': 1 };
      assert.strictEqual(_.eq(object, object), true);
      assert.strictEqual(_.eq(object, { 'a': 1 }), false);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.escape');

  (function() {
    var escaped = '&amp;&lt;&gt;&quot;&#39;&#96;\/',
        unescaped = '&<>"\'`\/';

    escaped += escaped;
    unescaped += unescaped;

    QUnit.test('should escape values', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.escape(unescaped), escaped);
    });

    QUnit.test('should not escape the "/" character', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.escape('/'), '/');
    });

    QUnit.test('should handle strings with nothing to escape', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.escape('abc'), 'abc');
    });

    QUnit.test('should escape the same characters unescaped by `_.unescape`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.escape(_.unescape(escaped)), escaped);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.escapeRegExp');

  (function() {
    var escaped = '\\^\\$\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|\\\\',
        unescaped = '^$.*+?()[]{}|\\';

    QUnit.test('should escape values', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.escapeRegExp(unescaped + unescaped), escaped + escaped);
    });

    QUnit.test('should handle strings with nothing to escape', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.escapeRegExp('abc'), 'abc');
    });

    QUnit.test('should return an empty string for empty values', function(assert) {
      assert.expect(1);

      var values = [, null, undefined, ''],
          expected = lodashStable.map(values, stubString);

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.escapeRegExp(value) : _.escapeRegExp();
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.every');

  (function() {
    QUnit.test('should return `true` if `predicate` returns truthy for all elements', function(assert) {
      assert.expect(1);

      assert.strictEqual(lodashStable.every([true, 1, 'a'], identity), true);
    });

    QUnit.test('should return `true` for empty collections', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, stubTrue);

      var actual = lodashStable.map(empties, function(value) {
        try {
          return _.every(value, identity);
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` as soon as `predicate` returns falsey', function(assert) {
      assert.expect(2);

      var count = 0;

      assert.strictEqual(_.every([true, null, true], function(value) {
        count++;
        return value;
      }), false);

      assert.strictEqual(count, 2);
    });

    QUnit.test('should work with collections of `undefined` values (test in IE < 9)', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.every([undefined, undefined, undefined], identity), false);
    });

    QUnit.test('should use `_.identity` when `predicate` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value, index) {
        var array = [0];
        return index ? _.every(array, value) : _.every(array);
      });

      assert.deepEqual(actual, expected);

      expected = lodashStable.map(values, stubTrue);
      actual = lodashStable.map(values, function(value, index) {
        var array = [1];
        return index ? _.every(array, value) : _.every(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var objects = [{ 'a': 0, 'b': 1 }, { 'a': 1, 'b': 2 }];
      assert.strictEqual(_.every(objects, 'a'), false);
      assert.strictEqual(_.every(objects, 'b'), true);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(2);

      var objects = [{ 'a': 0, 'b': 0 }, { 'a': 0, 'b': 1 }];
      assert.strictEqual(_.every(objects, { 'a': 0 }), true);
      assert.strictEqual(_.every(objects, { 'b': 1 }), false);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map([[1]], _.every);
      assert.deepEqual(actual, [true]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('strict mode checks');

  lodashStable.each(['assign', 'assignIn', 'bindAll', 'defaults'], function(methodName) {
    var func = _[methodName],
        isBindAll = methodName == 'bindAll';

    QUnit.test('`_.' + methodName + '` should ' + (isStrict ? '' : 'not ') + 'throw strict mode errors', function(assert) {
      assert.expect(1);

      if (freeze) {
        var object = freeze({ 'a': undefined, 'b': function() {} }),
            pass = !isStrict;

        try {
          func(object, isBindAll ? 'b' : { 'a': 1 });
        } catch (e) {
          pass = !pass;
        }
        assert.ok(pass);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.fill');

  (function() {
    QUnit.test('should use a default `start` of `0` and a default `end` of `length`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      assert.deepEqual(_.fill(array, 'a'), ['a', 'a', 'a']);
    });

    QUnit.test('should use `undefined` for `value` if not given', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3],
          actual = _.fill(array);

      assert.deepEqual(actual, Array(3));
      assert.ok(lodashStable.every(actual, function(value, index) {
        return index in actual;
      }));
    });

    QUnit.test('should work with a positive `start`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      assert.deepEqual(_.fill(array, 'a', 1), [1, 'a', 'a']);
    });

    QUnit.test('should work with a `start` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(start) {
        var array = [1, 2, 3];
        assert.deepEqual(_.fill(array, 'a', start), [1, 2, 3]);
      });
    });

    QUnit.test('should treat falsey `start` values as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, lodashStable.constant(['a', 'a', 'a']));

      var actual = lodashStable.map(falsey, function(start) {
        var array = [1, 2, 3];
        return _.fill(array, 'a', start);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with a negative `start`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      assert.deepEqual(_.fill(array, 'a', -1), [1, 2, 'a']);
    });

    QUnit.test('should work with a negative `start` <= negative `length`', function(assert) {
      assert.expect(3);

      lodashStable.each([-3, -4, -Infinity], function(start) {
        var array = [1, 2, 3];
        assert.deepEqual(_.fill(array, 'a', start), ['a', 'a', 'a']);
      });
    });

    QUnit.test('should work with `start` >= `end`', function(assert) {
      assert.expect(2);

      lodashStable.each([2, 3], function(start) {
        var array = [1, 2, 3];
        assert.deepEqual(_.fill(array, 'a', start, 2), [1, 2, 3]);
      });
    });

    QUnit.test('should work with a positive `end`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      assert.deepEqual(_.fill(array, 'a', 0, 1), ['a', 2, 3]);
    });

    QUnit.test('should work with a `end` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(end) {
        var array = [1, 2, 3];
        assert.deepEqual(_.fill(array, 'a', 0, end), ['a', 'a', 'a']);
      });
    });

    QUnit.test('should treat falsey `end` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? ['a', 'a', 'a'] : [1, 2, 3];
      });

      var actual = lodashStable.map(falsey, function(end) {
        var array = [1, 2, 3];
        return _.fill(array, 'a', 0, end);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with a negative `end`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      assert.deepEqual(_.fill(array, 'a', 0, -1), ['a', 'a', 3]);
    });

    QUnit.test('should work with a negative `end` <= negative `length`', function(assert) {
      assert.expect(3);

      lodashStable.each([-3, -4, -Infinity], function(end) {
        var array = [1, 2, 3];
        assert.deepEqual(_.fill(array, 'a', 0, end), [1, 2, 3]);
      });
    });

    QUnit.test('should coerce `start` and `end` to integers', function(assert) {
      assert.expect(1);

      var positions = [[0.1, 1.6], ['0', 1], [0, '1'], ['1'], [NaN, 1], [1, NaN]];

      var actual = lodashStable.map(positions, function(pos) {
        var array = [1, 2, 3];
        return _.fill.apply(_, [array, 'a'].concat(pos));
      });

      assert.deepEqual(actual, [['a', 2, 3], ['a', 2, 3], ['a', 2, 3], [1, 'a', 'a'], ['a', 2, 3], [1, 2, 3]]);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2], [3, 4]],
          actual = lodashStable.map(array, _.fill);

      assert.deepEqual(actual, [[0, 0], [1, 1]]);
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(3);

      if (!isNpm) {
        var array = [1, 2, 3],
            wrapped = _(array).fill('a'),
            actual = wrapped.value();

        assert.ok(wrapped instanceof _);
        assert.strictEqual(actual, array);
        assert.deepEqual(actual, ['a', 'a', 'a']);
      }
      else {
        skipAssert(assert, 3);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.filter');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should return elements `predicate` returns truthy for', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.filter(array, isEven), [2]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  lodashStable.each(['find', 'findIndex', 'findKey', 'findLast', 'findLastIndex', 'findLastKey'], function(methodName) {
    QUnit.module('lodash.' + methodName);

    var array = [1, 2, 3, 4],
        func = _[methodName];

    var objects = [
      { 'a': 0, 'b': 0 },
      { 'a': 1, 'b': 1 },
      { 'a': 2, 'b': 2 }
    ];

    var expected = ({
      'find': [objects[1], undefined, objects[2]],
      'findIndex': [1, -1, 2],
      'findKey': ['1', undefined, '2'],
      'findLast': [objects[2], undefined, objects[2]],
      'findLastIndex': [2, -1, 2],
      'findLastKey': ['2', undefined, '2']
    })[methodName];

    QUnit.test('`_.' + methodName + '` should return the found value', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(objects, function(object) { return object.a; }), expected[0]);
    });

    QUnit.test('`_.' + methodName + '` should return `' + expected[1] + '` if value is not found', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(objects, function(object) { return object.a === 3; }), expected[1]);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(objects, { 'b': 2 }), expected[2]);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(objects, ['b', 2]), expected[2]);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(objects, 'b'), expected[0]);
    });

    QUnit.test('`_.' + methodName + '` should return `' + expected[1] + '` for empty collections', function(assert) {
      assert.expect(1);

      var emptyValues = lodashStable.endsWith(methodName, 'Index') ? lodashStable.reject(empties, lodashStable.isPlainObject) : empties,
          expecting = lodashStable.map(emptyValues, lodashStable.constant(expected[1]));

      var actual = lodashStable.map(emptyValues, function(value) {
        try {
          return func(value, { 'a': 3 });
        } catch (e) {}
      });

      assert.deepEqual(actual, expecting);
    });

    QUnit.test('`_.' + methodName + '` should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      var expected = ({
        'find': 1,
        'findIndex': 0,
        'findKey': '0',
        'findLast': 4,
        'findLastIndex': 3,
        'findLastKey': '3'
      })[methodName];

      if (!isNpm) {
        assert.strictEqual(_(array)[methodName](), expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(array).chain()[methodName]() instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should not execute immediately when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _(array).chain()[methodName]();
        assert.strictEqual(wrapped.__wrapped__, array);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should work in a lazy sequence', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var largeArray = lodashStable.range(1, LARGE_ARRAY_SIZE + 1),
            smallArray = array;

        lodashStable.times(2, function(index) {
          var array = index ? largeArray : smallArray,
              wrapped = _(array).filter(isEven);

          assert.strictEqual(wrapped[methodName](), func(lodashStable.filter(array, isEven)));
        });
      }
      else {
        skipAssert(assert, 2);
      }
    });
  });

  _.each(['find', 'findIndex', 'findLast', 'findLastIndex'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should provide correct `predicate` arguments for arrays', function(assert) {
      assert.expect(1);

      var args,
          array = ['a'];

      func(array, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, ['a', 0, array]);
    });
  });

  _.each(['find', 'findKey', 'findLast', 'findLastKey'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should work with an object for `collection`', function(assert) {
      assert.expect(1);

      var actual = func({ 'a': 1, 'b': 2, 'c': 3 }, function(n) {
        return n < 3;
      });

      var expected = ({
        'find': 1,
        'findKey': 'a',
        'findLast': 2,
        'findLastKey': 'b'
      })[methodName];

      assert.strictEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should provide correct `predicate` arguments for objects', function(assert) {
      assert.expect(1);

      var args,
          object = { 'a': 1 };

      func(object, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [1, 'a', object]);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.find and lodash.findLast');

  lodashStable.each(['find', 'findLast'], function(methodName) {
    var isFind = methodName == 'find';

    QUnit.test('`_.' + methodName + '` should support shortcut fusion', function(assert) {
      assert.expect(3);

      if (!isNpm) {
        var findCount = 0,
            mapCount = 0,
            array = lodashStable.range(1, LARGE_ARRAY_SIZE + 1),
            iteratee = function(value) { mapCount++; return square(value); },
            predicate = function(value) { findCount++; return isEven(value); },
            actual = _(array).map(iteratee)[methodName](predicate);

        assert.strictEqual(findCount, isFind ? 2 : 1);
        assert.strictEqual(mapCount, isFind ? 2 : 1);
        assert.strictEqual(actual, isFind ? 4 : square(LARGE_ARRAY_SIZE));
      }
      else {
        skipAssert(assert, 3);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.find and lodash.includes');

  lodashStable.each(['includes', 'find'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3, 4)),
        func = _[methodName],
        isIncludes = methodName == 'includes',
        resolve = methodName == 'find' ? lodashStable.curry(lodashStable.eq) : identity;

    lodashStable.each({
      'an `arguments` object': args,
      'an array': [1, 2, 3, 4]
    },
    function(collection, key) {
      var values = lodashStable.toArray(collection);

      QUnit.test('`_.' + methodName + '` should work with ' + key + ' and a positive `fromIndex`', function(assert) {
        assert.expect(1);

        var expected = [
          isIncludes || values[2],
          isIncludes ? false : undefined
        ];

        var actual = [
          func(collection, resolve(values[2]), 2),
          func(collection, resolve(values[1]), 2)
        ];

        assert.deepEqual(actual, expected);
      });

      QUnit.test('`_.' + methodName + '` should work with ' + key + ' and a `fromIndex` >= `length`', function(assert) {
        assert.expect(1);

        var indexes = [4, 6, Math.pow(2, 32), Infinity];

        var expected = lodashStable.map(indexes, function() {
          var result = isIncludes ? false : undefined;
          return [result, result, result];
        });

        var actual = lodashStable.map(indexes, function(fromIndex) {
          return [
            func(collection, resolve(1), fromIndex),
            func(collection, resolve(undefined), fromIndex),
            func(collection, resolve(''), fromIndex)
          ];
        });

        assert.deepEqual(actual, expected);
      });

      QUnit.test('`_.' + methodName + '` should work with ' + key + ' and treat falsey `fromIndex` values as `0`', function(assert) {
        assert.expect(1);

        var expected = lodashStable.map(falsey, lodashStable.constant(isIncludes || values[0]));

        var actual = lodashStable.map(falsey, function(fromIndex) {
          return func(collection, resolve(values[0]), fromIndex);
        });

        assert.deepEqual(actual, expected);
      });

      QUnit.test('`_.' + methodName + '` should work with ' + key + ' and coerce `fromIndex` to an integer', function(assert) {
        assert.expect(1);

        var expected = [
          isIncludes || values[0],
          isIncludes || values[0],
          isIncludes ? false : undefined
        ];

        var actual = [
          func(collection, resolve(values[0]), 0.1),
          func(collection, resolve(values[0]), NaN),
          func(collection, resolve(values[0]), '1')
        ];

        assert.deepEqual(actual, expected);
      });

      QUnit.test('`_.' + methodName + '` should work with ' + key + ' and a negative `fromIndex`', function(assert) {
        assert.expect(1);

        var expected = [
          isIncludes || values[2],
          isIncludes ? false : undefined
        ];

        var actual = [
          func(collection, resolve(values[2]), -2),
          func(collection, resolve(values[1]), -2)
        ];

        assert.deepEqual(actual, expected);
      });

      QUnit.test('`_.' + methodName + '` should work with ' + key + ' and a negative `fromIndex` <= `-length`', function(assert) {
        assert.expect(1);

        var indexes = [-4, -6, -Infinity],
            expected = lodashStable.map(indexes, lodashStable.constant(isIncludes || values[0]));

        var actual = lodashStable.map(indexes, function(fromIndex) {
          return func(collection, resolve(values[0]), fromIndex);
        });

        assert.deepEqual(actual, expected);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.findIndex and lodash.indexOf');

  lodashStable.each(['findIndex', 'indexOf'], function(methodName) {
    var array = [1, 2, 3, 1, 2, 3],
        func = _[methodName],
        resolve = methodName == 'findIndex' ? lodashStable.curry(lodashStable.eq) : identity;

    QUnit.test('`_.' + methodName + '` should return the index of the first matched value', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(3)), 2);
    });

    QUnit.test('`_.' + methodName + '` should work with a positive `fromIndex`', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(1), 2), 3);
    });

    QUnit.test('`_.' + methodName + '` should work with a `fromIndex` >= `length`', function(assert) {
      assert.expect(1);

      var values = [6, 8, Math.pow(2, 32), Infinity],
          expected = lodashStable.map(values, lodashStable.constant([-1, -1, -1]));

      var actual = lodashStable.map(values, function(fromIndex) {
        return [
          func(array, resolve(undefined), fromIndex),
          func(array, resolve(1), fromIndex),
          func(array, resolve(''), fromIndex)
        ];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with a negative `fromIndex`', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(2), -3), 4);
    });

    QUnit.test('`_.' + methodName + '` should work with a negative `fromIndex` <= `-length`', function(assert) {
      assert.expect(1);

      var values = [-6, -8, -Infinity],
          expected = lodashStable.map(values, stubZero);

      var actual = lodashStable.map(values, function(fromIndex) {
        return func(array, resolve(1), fromIndex);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should treat falsey `fromIndex` values as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubZero);

      var actual = lodashStable.map(falsey, function(fromIndex) {
        return func(array, resolve(1), fromIndex);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should coerce `fromIndex` to an integer', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(2), 1.2), 1);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.findLast');

  (function() {
    var args = (function() { return arguments; }(1, 2, 3, 4)),
        resolve = lodashStable.curry(lodashStable.eq);

    lodashStable.each({
      'an `arguments` object': args,
      'an array': [1, 2, 3, 4],
    },
    function(collection, key) {
      var values = lodashStable.toArray(collection);

      QUnit.test('should work with ' + key + ' and a positive `fromIndex`', function(assert) {
        assert.expect(1);

        var expected = [
          values[2],
          undefined
        ];

        var actual = [
          _.findLast(collection, resolve(values[2]), 2),
          _.findLast(collection, resolve(values[3]), 2)
        ];

        assert.deepEqual(actual, expected);
      });

      QUnit.test('should work with ' + key + ' and a `fromIndex` >= `length`', function(assert) {
        assert.expect(1);

        var indexes = [4, 6, Math.pow(2, 32), Infinity];

        var expected = lodashStable.map(indexes, lodashStable.constant([values[0], undefined, undefined]));

        var actual = lodashStable.map(indexes, function(fromIndex) {
          return [
            _.findLast(collection, resolve(1), fromIndex),
            _.findLast(collection, resolve(undefined), fromIndex),
            _.findLast(collection, resolve(''), fromIndex)
          ];
        });

        assert.deepEqual(actual, expected);
      });

      QUnit.test('should work with ' + key + ' and treat falsey `fromIndex` values correctly', function(assert) {
        assert.expect(1);

        var expected = lodashStable.map(falsey, function(value) {
          return value === undefined ? values[3] : undefined;
        });

        var actual = lodashStable.map(falsey, function(fromIndex) {
          return _.findLast(collection, resolve(values[3]), fromIndex);
        });

        assert.deepEqual(actual, expected);
      });

      QUnit.test('should work with ' + key + ' and coerce `fromIndex` to an integer', function(assert) {
        assert.expect(1);

        var expected = [
          values[0],
          values[0],
          undefined
        ];

        var actual = [
          _.findLast(collection, resolve(values[0]), 0.1),
          _.findLast(collection, resolve(values[0]), NaN),
          _.findLast(collection, resolve(values[2]), '1')
        ];

        assert.deepEqual(actual, expected);
      });

      QUnit.test('should work with ' + key + ' and a negative `fromIndex`', function(assert) {
        assert.expect(1);

        var expected = [
          values[2],
          undefined
        ];

        var actual = [
          _.findLast(collection, resolve(values[2]), -2),
          _.findLast(collection, resolve(values[3]), -2)
        ];

        assert.deepEqual(actual, expected);
      });

      QUnit.test('should work with ' + key + ' and a negative `fromIndex` <= `-length`', function(assert) {
        assert.expect(1);

        var indexes = [-4, -6, -Infinity],
            expected = lodashStable.map(indexes, lodashStable.constant(values[0]));

        var actual = lodashStable.map(indexes, function(fromIndex) {
          return _.findLast(collection, resolve(values[0]), fromIndex);
        });

        assert.deepEqual(actual, expected);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.flip');

  (function() {
    function fn() {
      return slice.call(arguments);
    }

    QUnit.test('should flip arguments provided to `func`', function(assert) {
      assert.expect(1);

      var flipped = _.flip(fn);
      assert.deepEqual(flipped('a', 'b', 'c', 'd'), ['d', 'c', 'b', 'a']);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.flatMapDepth');

  (function() {
    var array = [1, [2, [3, [4]], 5]];

    QUnit.test('should use a default `depth` of `1`', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.flatMapDepth(array, identity), [1, 2, [3, [4]], 5]);
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([1, 2, [3, [4]], 5]));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.flatMapDepth(array, value) : _.flatMapDepth(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should treat a `depth` of < `1` as a shallow clone', function(assert) {
      assert.expect(2);

      lodashStable.each([-1, 0], function(depth) {
        assert.deepEqual(_.flatMapDepth(array, identity, depth), [1, [2, [3, [4]], 5]]);
      });
    });

    QUnit.test('should coerce `depth` to an integer', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.flatMapDepth(array, identity, 2.2), [1, 2, 3, [4], 5]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('flatMap methods');

  lodashStable.each(['flatMap', 'flatMapDeep', 'flatMapDepth'], function(methodName) {
    var func = _[methodName],
        array = [1, 2, 3, 4];

    function duplicate(n) {
      return [n, n];
    }

    QUnit.test('`_.' + methodName + '` should map values in `array` to a new flattened array', function(assert) {
      assert.expect(1);

      var actual = func(array, duplicate),
          expected = lodashStable.flatten(lodashStable.map(array, duplicate));

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': [1, 2] }, { 'a': [3, 4] }];
      assert.deepEqual(func(objects, 'a'), array);
    });

    QUnit.test('`_.' + methodName + '` should iterate over own string keyed properties of objects', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = [1, 2];
      }
      Foo.prototype.b = [3, 4];

      var actual = func(new Foo, identity);
      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('`_.' + methodName + '` should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(2);

      var array = [[1, 2], [3, 4]],
          object = { 'a': [1, 2], 'b': [3, 4] },
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([1, 2, 3, 4]));

      lodashStable.each([array, object], function(collection) {
        var actual = lodashStable.map(values, function(value, index) {
          return index ? func(collection, value) : func(collection);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should accept a falsey `collection` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubArray);

      var actual = lodashStable.map(falsey, function(collection, index) {
        try {
          return index ? func(collection) : func();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should treat number values for `collection` as empty', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(1), []);
    });

    QUnit.test('`_.' + methodName + '` should work with objects with non-number length properties', function(assert) {
      assert.expect(1);

      var object = { 'length': [1, 2] };
      assert.deepEqual(func(object, identity), [1, 2]);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.flattenDepth');

  (function() {
    var array = [1, [2, [3, [4]], 5]];

    QUnit.test('should use a default `depth` of `1`', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.flattenDepth(array), [1, 2, [3, [4]], 5]);
    });

    QUnit.test('should treat a `depth` of < `1` as a shallow clone', function(assert) {
      assert.expect(2);

      lodashStable.each([-1, 0], function(depth) {
        assert.deepEqual(_.flattenDepth(array, depth), [1, [2, [3, [4]], 5]]);
      });
    });

    QUnit.test('should coerce `depth` to an integer', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.flattenDepth(array, 2.2), [1, 2, 3, [4], 5]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('flatten methods');

  (function() {
    var args = arguments,
        array = [1, [2, [3, [4]], 5]],
        methodNames = ['flatten', 'flattenDeep', 'flattenDepth'];

    QUnit.test('should flatten `arguments` objects', function(assert) {
      assert.expect(3);

      var array = [args, [args]];

      assert.deepEqual(_.flatten(array), [1, 2, 3, args]);
      assert.deepEqual(_.flattenDeep(array), [1, 2, 3, 1, 2, 3]);
      assert.deepEqual(_.flattenDepth(array, 2), [1, 2, 3, 1, 2, 3]);
    });

    QUnit.test('should treat sparse arrays as dense', function(assert) {
      assert.expect(6);

      var array = [[1, 2, 3], Array(3)],
          expected = [1, 2, 3];

      expected.push(undefined, undefined, undefined);

      lodashStable.each(methodNames, function(methodName) {
        var actual = _[methodName](array);
        assert.deepEqual(actual, expected);
        assert.ok('4' in actual);
      });
    });

    QUnit.test('should flatten objects with a truthy `Symbol.isConcatSpreadable` value', function(assert) {
      assert.expect(1);

      if (Symbol && Symbol.isConcatSpreadable) {
        var object = { '0': 'a', 'length': 1 },
            array = [object],
            expected = lodashStable.map(methodNames, lodashStable.constant(['a']));

        object[Symbol.isConcatSpreadable] = true;

        var actual = lodashStable.map(methodNames, function(methodName) {
          return _[methodName](array);
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should work with extremely large arrays', function(assert) {
      assert.expect(3);

      lodashStable.times(3, function(index) {
        var expected = Array(5e5);
        try {
          var func = _.flatten;
          if (index == 1) {
            func = _.flattenDeep;
          } else if (index == 2) {
            func = _.flattenDepth;
          }
          assert.deepEqual(func([expected]), expected);
        } catch (e) {
          assert.ok(false, e.message);
        }
      });
    });

    QUnit.test('should work with empty arrays', function(assert) {
      assert.expect(3);

      var array = [[], [[]], [[], [[[]]]]];

      assert.deepEqual(_.flatten(array), [[], [], [[[]]]]);
      assert.deepEqual(_.flattenDeep(array), []);
      assert.deepEqual(_.flattenDepth(array, 2), [[[]]]);
    });

    QUnit.test('should support flattening of nested arrays', function(assert) {
      assert.expect(3);

      assert.deepEqual(_.flatten(array), [1, 2, [3, [4]], 5]);
      assert.deepEqual(_.flattenDeep(array), [1, 2, 3, 4, 5]);
      assert.deepEqual(_.flattenDepth(array, 2), [1, 2, 3, [4], 5]);
    });

    QUnit.test('should return an empty array for non array-like objects', function(assert) {
      assert.expect(3);

      var expected = [],
          nonArray = { '0': 'a' };

      assert.deepEqual(_.flatten(nonArray), expected);
      assert.deepEqual(_.flattenDeep(nonArray), expected);
      assert.deepEqual(_.flattenDepth(nonArray, 2), expected);
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        var wrapped = _(array),
            actual = wrapped.flatten();

        assert.ok(actual instanceof _);
        assert.deepEqual(actual.value(), [1, 2, [3, [4]], 5]);

        actual = wrapped.flattenDeep();

        assert.ok(actual instanceof _);
        assert.deepEqual(actual.value(), [1, 2, 3, 4, 5]);

        actual = wrapped.flattenDepth(2);

        assert.ok(actual instanceof _);
        assert.deepEqual(actual.value(), [1, 2, 3, [4], 5]);
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('flow methods');

  lodashStable.each(['flow', 'flowRight'], function(methodName) {
    var func = _[methodName],
        isFlow = methodName == 'flow';

    QUnit.test('`_.' + methodName + '` should supply each function with the return value of the previous', function(assert) {
      assert.expect(1);

      var fixed = function(n) { return n.toFixed(1); },
          combined = isFlow ? func(add, square, fixed) : func(fixed, square, add);

      assert.strictEqual(combined(1, 2), '9.0');
    });

    QUnit.test('`_.' + methodName + '` should return a new function', function(assert) {
      assert.expect(1);

      assert.notStrictEqual(func(noop), noop);
    });

    QUnit.test('`_.' + methodName + '` should return an identity function when no arguments are given', function(assert) {
      assert.expect(6);

      _.times(2, function(index) {
        try {
          var combined = index ? func([]) : func();
          assert.strictEqual(combined('a'), 'a');
        } catch (e) {
          assert.ok(false, e.message);
        }
        assert.strictEqual(combined.length, 0);
        assert.notStrictEqual(combined, identity);
      });
    });

    QUnit.test('`_.' + methodName + '` should work with a curried function and `_.head`', function(assert) {
      assert.expect(1);

      var curried = _.curry(identity);

      var combined = isFlow
        ? func(_.head, curried)
        : func(curried, _.head);

      assert.strictEqual(combined([1]), 1);
    });

    QUnit.test('`_.' + methodName + '` should support shortcut fusion', function(assert) {
      assert.expect(6);

      var filterCount,
          mapCount,
          array = lodashStable.range(LARGE_ARRAY_SIZE),
          iteratee = function(value) { mapCount++; return square(value); },
          predicate = function(value) { filterCount++; return isEven(value); };

      lodashStable.times(2, function(index) {
        var filter1 = _.filter,
            filter2 = _.curry(_.rearg(_.ary(_.filter, 2), 1, 0), 2),
            filter3 = (_.filter = index ? filter2 : filter1, filter2(predicate));

        var map1 = _.map,
            map2 = _.curry(_.rearg(_.ary(_.map, 2), 1, 0), 2),
            map3 = (_.map = index ? map2 : map1, map2(iteratee));

        var take1 = _.take,
            take2 = _.curry(_.rearg(_.ary(_.take, 2), 1, 0), 2),
            take3 = (_.take = index ? take2 : take1, take2(2));

        var combined = isFlow
          ? func(map3, filter3, _.compact, take3)
          : func(take3, _.compact, filter3, map3);

        filterCount = mapCount = 0;
        assert.deepEqual(combined(array), [4, 16]);

        if (!isNpm && WeakMap && WeakMap.name) {
          assert.strictEqual(filterCount, 5, 'filterCount');
          assert.strictEqual(mapCount, 5, 'mapCount');
        }
        else {
          skipAssert(assert, 2);
        }
        _.filter = filter1;
        _.map = map1;
        _.take = take1;
      });
    });

    QUnit.test('`_.' + methodName + '` should work with curried functions with placeholders', function(assert) {
      assert.expect(1);

      var curried = _.curry(_.ary(_.map, 2), 2),
          getProp = curried(curried.placeholder, 'a'),
          objects = [{ 'a': 1 }, { 'a': 2 }, { 'a': 1 }];

      var combined = isFlow
        ? func(getProp, _.uniq)
        : func(_.uniq, getProp);

      assert.deepEqual(combined(objects), [1, 2]);
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _(noop)[methodName]();
        assert.ok(wrapped instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.forEach');

  (function() {
    QUnit.test('should be aliased', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.each, _.forEach);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.forEachRight');

  (function() {
    QUnit.test('should be aliased', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.eachRight, _.forEachRight);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('forIn methods');

  lodashStable.each(['forIn', 'forInRight'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` iterates over inherited string keyed properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var keys = [];
      func(new Foo, function(value, key) { keys.push(key); });
      assert.deepEqual(keys.sort(), ['a', 'b']);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('forOwn methods');

  lodashStable.each(['forOwn', 'forOwnRight'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should iterate over `length` properties', function(assert) {
      assert.expect(1);

      var object = { '0': 'zero', '1': 'one', 'length': 2 },
          props = [];

      func(object, function(value, prop) { props.push(prop); });
      assert.deepEqual(props.sort(), ['0', '1', 'length']);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('iteration methods');

  (function() {
    var methods = [
      '_baseEach',
      'countBy',
      'every',
      'filter',
      'find',
      'findIndex',
      'findKey',
      'findLast',
      'findLastIndex',
      'findLastKey',
      'forEach',
      'forEachRight',
      'forIn',
      'forInRight',
      'forOwn',
      'forOwnRight',
      'groupBy',
      'keyBy',
      'map',
      'mapKeys',
      'mapValues',
      'maxBy',
      'minBy',
      'omitBy',
      'partition',
      'pickBy',
      'reject',
      'some'
    ];

    var arrayMethods = [
      'findIndex',
      'findLastIndex',
      'maxBy',
      'minBy'
    ];

    var collectionMethods = [
      '_baseEach',
      'countBy',
      'every',
      'filter',
      'find',
      'findLast',
      'forEach',
      'forEachRight',
      'groupBy',
      'keyBy',
      'map',
      'partition',
      'reduce',
      'reduceRight',
      'reject',
      'some'
    ];

    var forInMethods = [
      'forIn',
      'forInRight',
      'omitBy',
      'pickBy'
    ];

    var iterationMethods = [
      '_baseEach',
      'forEach',
      'forEachRight',
      'forIn',
      'forInRight',
      'forOwn',
      'forOwnRight'
    ];

    var objectMethods = [
      'findKey',
      'findLastKey',
      'forIn',
      'forInRight',
      'forOwn',
      'forOwnRight',
      'mapKeys',
      'mapValues',
      'omitBy',
      'pickBy'
    ];

    var rightMethods = [
      'findLast',
      'findLastIndex',
      'findLastKey',
      'forEachRight',
      'forInRight',
      'forOwnRight'
    ];

    var unwrappedMethods = [
      'each',
      'eachRight',
      'every',
      'find',
      'findIndex',
      'findKey',
      'findLast',
      'findLastIndex',
      'findLastKey',
      'forEach',
      'forEachRight',
      'forIn',
      'forInRight',
      'forOwn',
      'forOwnRight',
      'max',
      'maxBy',
      'min',
      'minBy',
      'some'
    ];

    lodashStable.each(methods, function(methodName) {
      var array = [1, 2, 3],
          func = _[methodName],
          isBy = /(^partition|By)$/.test(methodName),
          isFind = /^find/.test(methodName),
          isOmitPick = /^(?:omit|pick)By$/.test(methodName),
          isSome = methodName == 'some';

      QUnit.test('`_.' + methodName + '` should provide correct iteratee arguments', function(assert) {
        assert.expect(1);

        if (func) {
          var args,
              expected = [1, 0, array];

          func(array, function() {
            args || (args = slice.call(arguments));
          });

          if (lodashStable.includes(rightMethods, methodName)) {
            expected[0] = 3;
            expected[1] = 2;
          }
          if (lodashStable.includes(objectMethods, methodName)) {
            expected[1] += '';
          }
          if (isBy) {
            expected.length = isOmitPick ? 2 : 1;
          }
          assert.deepEqual(args, expected);
        }
        else {
          skipAssert(assert);
        }
      });

      QUnit.test('`_.' + methodName + '` should treat sparse arrays as dense', function(assert) {
        assert.expect(1);

        if (func) {
          var array = [1];
          array[2] = 3;

          var expected = lodashStable.includes(objectMethods, methodName)
            ? [[1, '0', array], [undefined, '1', array], [3, '2', array]]
            : [[1,  0, array],  [undefined,  1,  array], [3,  2,  array]];

          if (isBy) {
            expected = lodashStable.map(expected, function(args) {
              return args.slice(0, isOmitPick ? 2 : 1);
            });
          }
          else if (lodashStable.includes(objectMethods, methodName)) {
            expected = lodashStable.map(expected, function(args) {
              args[1] += '';
              return args;
            });
          }
          if (lodashStable.includes(rightMethods, methodName)) {
            expected.reverse();
          }
          var argsList = [];
          func(array, function() {
            argsList.push(slice.call(arguments));
            return !(isFind || isSome);
          });

          assert.deepEqual(argsList, expected);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    lodashStable.each(lodashStable.difference(methods, objectMethods), function(methodName) {
      var array = [1, 2, 3],
          func = _[methodName],
          isEvery = methodName == 'every';

      array.a = 1;

      QUnit.test('`_.' + methodName + '` should not iterate custom properties on arrays', function(assert) {
        assert.expect(1);

        if (func) {
          var keys = [];
          func(array, function(value, key) {
            keys.push(key);
            return isEvery;
          });

          assert.notOk(lodashStable.includes(keys, 'a'));
        }
        else {
          skipAssert(assert);
        }
      });
    });

    lodashStable.each(lodashStable.difference(methods, unwrappedMethods), function(methodName) {
      var array = [1, 2, 3],
          isBaseEach = methodName == '_baseEach';

      QUnit.test('`_.' + methodName + '` should return a wrapped value when implicitly chaining', function(assert) {
        assert.expect(1);

        if (!(isBaseEach || isNpm)) {
          var wrapped = _(array)[methodName](noop);
          assert.ok(wrapped instanceof _);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    lodashStable.each(unwrappedMethods, function(methodName) {
      var array = [1, 2, 3];

      QUnit.test('`_.' + methodName + '` should return an unwrapped value when implicitly chaining', function(assert) {
        assert.expect(1);

        if (!isNpm) {
          var actual = _(array)[methodName](noop);
          assert.notOk(actual instanceof _);
        }
        else {
          skipAssert(assert);
        }
      });

      QUnit.test('`_.' + methodName + '` should return a wrapped value when explicitly chaining', function(assert) {
        assert.expect(2);

        if (!isNpm) {
          var wrapped = _(array).chain(),
              actual = wrapped[methodName](noop);

          assert.ok(actual instanceof _);
          assert.notStrictEqual(actual, wrapped);
        }
        else {
          skipAssert(assert, 2);
        }
      });
    });

    lodashStable.each(lodashStable.difference(methods, arrayMethods, forInMethods), function(methodName) {
      var func = _[methodName];

      QUnit.test('`_.' + methodName + '` iterates over own string keyed properties of objects', function(assert) {
        assert.expect(1);

        function Foo() {
          this.a = 1;
        }
        Foo.prototype.b = 2;

        if (func) {
          var values = [];
          func(new Foo, function(value) { values.push(value); });
          assert.deepEqual(values, [1]);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    lodashStable.each(iterationMethods, function(methodName) {
      var array = [1, 2, 3],
          func = _[methodName];

      QUnit.test('`_.' + methodName + '` should return the collection', function(assert) {
        assert.expect(1);

        if (func) {
          assert.strictEqual(func(array, Boolean), array);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    lodashStable.each(collectionMethods, function(methodName) {
      var func = _[methodName];

      QUnit.test('`_.' + methodName + '` should use `isArrayLike` to determine whether a value is array-like', function(assert) {
        assert.expect(3);

        if (func) {
          var isIteratedAsObject = function(object) {
            var result = false;
            func(object, function() { result = true; }, 0);
            return result;
          };

          var values = [-1, '1', 1.1, Object(1), MAX_SAFE_INTEGER + 1],
              expected = lodashStable.map(values, stubTrue);

          var actual = lodashStable.map(values, function(length) {
            return isIteratedAsObject({ 'length': length });
          });

          var Foo = function(a) {};
          Foo.a = 1;

          assert.deepEqual(actual, expected);
          assert.ok(isIteratedAsObject(Foo));
          assert.notOk(isIteratedAsObject({ 'length': 0 }));
        }
        else {
          skipAssert(assert, 3);
        }
      });
    });

    lodashStable.each(methods, function(methodName) {
      var func = _[methodName],
          isFind = /^find/.test(methodName),
          isSome = methodName == 'some',
          isReduce = /^reduce/.test(methodName);

      QUnit.test('`_.' + methodName + '` should ignore changes to `length`', function(assert) {
        assert.expect(1);

        if (func) {
          var count = 0,
              array = [1];

          func(array, function() {
            if (++count == 1) {
              array.push(2);
            }
            return !(isFind || isSome);
          }, isReduce ? array : null);

          assert.strictEqual(count, 1);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    lodashStable.each(lodashStable.difference(lodashStable.union(methods, collectionMethods), arrayMethods), function(methodName) {
      var func = _[methodName],
          isFind = /^find/.test(methodName),
          isSome = methodName == 'some',
          isReduce = /^reduce/.test(methodName);

      QUnit.test('`_.' + methodName + '` should ignore added `object` properties', function(assert) {
        assert.expect(1);

        if (func) {
          var count = 0,
              object = { 'a': 1 };

          func(object, function() {
            if (++count == 1) {
              object.b = 2;
            }
            return !(isFind || isSome);
          }, isReduce ? object : null);

          assert.strictEqual(count, 1);
        }
        else {
          skipAssert(assert);
        }
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('object assignments');

  lodashStable.each(['assign', 'assignIn', 'defaults', 'merge'], function(methodName) {
    var func = _[methodName],
        isAssign = methodName == 'assign',
        isDefaults = methodName == 'defaults';

    QUnit.test('`_.' + methodName + '` should coerce primitives to objects', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(primitives, function(value) {
        var object = Object(value);
        object.a = 1;
        return object;
      });

      var actual = lodashStable.map(primitives, function(value) {
        return func(value, { 'a': 1 });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should assign own ' + (isAssign ? '' : 'and inherited ') + 'string keyed source properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var expected = isAssign ? { 'a': 1 } : { 'a': 1, 'b': 2 };
      assert.deepEqual(func({}, new Foo), expected);
    });

    QUnit.test('`_.' + methodName + '` should not skip a trailing function source', function(assert) {
      assert.expect(1);

      function fn() {}
      fn.b = 2;

      assert.deepEqual(func({}, { 'a': 1 }, fn), { 'a': 1, 'b': 2 });
    });

    QUnit.test('`_.' + methodName + '` should not error on nullish sources', function(assert) {
      assert.expect(1);

      try {
        assert.deepEqual(func({ 'a': 1 }, undefined, { 'b': 2 }, null), { 'a': 1, 'b': 2 });
      } catch (e) {
        assert.ok(false, e.message);
      }
    });

    QUnit.test('`_.' + methodName + '` should create an object when `object` is nullish', function(assert) {
      assert.expect(2);

      var source = { 'a': 1 },
          values = [null, undefined],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        var object = func(value, source);
        return object !== source && lodashStable.isEqual(object, source);
      });

      assert.deepEqual(actual, expected);

      actual = lodashStable.map(values, function(value) {
        return lodashStable.isEqual(func(value), {});
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work as an iteratee for methods like `_.reduce`', function(assert) {
      assert.expect(2);

      var array = [{ 'a': 1 }, { 'b': 2 }, { 'c': 3 }],
          expected = { 'a': isDefaults ? 0 : 1, 'b': 2, 'c': 3 };

      function fn() {};
      fn.a = array[0];
      fn.b = array[1];
      fn.c = array[2];

      assert.deepEqual(lodashStable.reduce(array, func, { 'a': 0 }), expected);
      assert.deepEqual(lodashStable.reduce(fn, func, { 'a': 0 }), expected);
    });

    QUnit.test('`_.' + methodName + '` should not return the existing wrapped value when chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _({ 'a': 1 }),
            actual = wrapped[methodName]({ 'b': 2 });

        assert.notStrictEqual(actual, wrapped);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  lodashStable.each(['assign', 'assignIn', 'merge'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should not treat `object` as `source`', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.prototype.a = 1;

      var actual = func(new Foo, { 'b': 2 });
      assert.notOk(_.has(actual, 'a'));
    });
  });

  lodashStable.each(['assign', 'assignIn', 'assignInWith', 'assignWith', 'defaults', 'merge', 'mergeWith'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should not assign values that are the same as their destinations', function(assert) {
      assert.expect(4);

      lodashStable.each(['a', ['a'], { 'a': 1 }, NaN], function(value) {
        var object = {},
            pass = true;

        defineProperty(object, 'a', {
          'enumerable': true,
          'configurable': true,
          'get': lodashStable.constant(value),
          'set': function() { pass = false; }
        });

        func(object, { 'a': value });
        assert.ok(pass);
      });
    });
  });

  lodashStable.each(['assignWith', 'assignInWith', 'mergeWith'], function(methodName) {
    var func = _[methodName],
        isMergeWith = methodName == 'mergeWith';

    QUnit.test('`_.' + methodName + '` should provide correct `customizer` arguments', function(assert) {
      assert.expect(3);

      var args,
          object = { 'a': 1 },
          source = { 'a': 2 },
          expected = lodashStable.map([1, 2, 'a', object, source], lodashStable.cloneDeep);

      func(object, source, function() {
        args || (args = lodashStable.map(slice.call(arguments, 0, 5), lodashStable.cloneDeep));
      });

      assert.deepEqual(args, expected, 'primitive property values');

      args = undefined;
      object = { 'a': 1 };
      source = { 'b': 2 };
      expected = lodashStable.map([undefined, 2, 'b', object, source], lodashStable.cloneDeep);

      func(object, source, function() {
        args || (args = lodashStable.map(slice.call(arguments, 0, 5), lodashStable.cloneDeep));
      });

      assert.deepEqual(args, expected, 'missing destination property');

      var argsList = [],
          objectValue = [1, 2],
          sourceValue = { 'b': 2 };

      object = { 'a': objectValue };
      source = { 'a': sourceValue };
      expected = [lodashStable.map([objectValue, sourceValue, 'a', object, source], lodashStable.cloneDeep)];

      if (isMergeWith) {
        expected.push(lodashStable.map([undefined, 2, 'b', objectValue, sourceValue], lodashStable.cloneDeep));
      }
      func(object, source, function() {
        argsList.push(lodashStable.map(slice.call(arguments, 0, 5), lodashStable.cloneDeep));
      });

      assert.deepEqual(argsList, expected, 'object property values');
    });

    QUnit.test('`_.' + methodName + '` should not treat the second argument as a `customizer` callback', function(assert) {
      assert.expect(2);

      function callback() {}
      callback.b = 2;

      var actual = func({ 'a': 1 }, callback);
      assert.deepEqual(actual, { 'a': 1, 'b': 2 });

      actual = func({ 'a': 1 }, callback, { 'c': 3 });
      assert.deepEqual(actual, { 'a': 1, 'b': 2, 'c': 3 });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('exit early');

  lodashStable.each(['_baseEach', 'forEach', 'forEachRight', 'forIn', 'forInRight', 'forOwn', 'forOwnRight', 'transform'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` can exit early when iterating arrays', function(assert) {
      assert.expect(1);

      if (func) {
        var array = [1, 2, 3],
            values = [];

        func(array, function(value, other) {
          values.push(lodashStable.isArray(value) ? other : value);
          return false;
        });

        assert.deepEqual(values, [lodashStable.endsWith(methodName, 'Right') ? 3 : 1]);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` can exit early when iterating objects', function(assert) {
      assert.expect(1);

      if (func) {
        var object = { 'a': 1, 'b': 2, 'c': 3 },
            values = [];

        func(object, function(value, other) {
          values.push(lodashStable.isArray(value) ? other : value);
          return false;
        });

        assert.strictEqual(values.length, 1);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('`__proto__` property bugs');

  (function() {
    QUnit.test('internal data objects should work with the `__proto__` key', function(assert) {
      assert.expect(4);

      var stringLiteral = '__proto__',
          stringObject = Object(stringLiteral),
          expected = [stringLiteral, stringObject];

      var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, function(count) {
        return isEven(count) ? stringLiteral : stringObject;
      });

      assert.deepEqual(_.difference(largeArray, largeArray), []);
      assert.deepEqual(_.intersection(largeArray, largeArray), expected);
      assert.deepEqual(_.uniq(largeArray), expected);
      assert.deepEqual(_.without.apply(_, [largeArray].concat(largeArray)), []);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.fromPairs');

  (function() {
    QUnit.test('should accept a two dimensional array', function(assert) {
      assert.expect(1);

      var array = [['a', 1], ['b', 2]],
          object = { 'a': 1, 'b': 2 },
          actual = _.fromPairs(array);

      assert.deepEqual(actual, object);
    });

    QUnit.test('should accept a falsey `array` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubObject);

      var actual = lodashStable.map(falsey, function(array, index) {
        try {
          return index ? _.fromPairs(array) : _.fromPairs();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not support deep paths', function(assert) {
      assert.expect(1);

      var actual = _.fromPairs([['a.b', 1]]);
      assert.deepEqual(actual, { 'a.b': 1 });
    });

    QUnit.test('should support consuming the return value of `_.toPairs`', function(assert) {
      assert.expect(1);

      var object = { 'a.b': 1 };
      assert.deepEqual(_.fromPairs(_.toPairs(object)), object);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array = lodashStable.times(LARGE_ARRAY_SIZE, function(index) {
          return ['key' + index, index];
        });

        var actual = _(array).fromPairs().map(square).filter(isEven).take().value();

        assert.deepEqual(actual, _.take(_.filter(_.map(_.fromPairs(array), square), isEven)));
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.functions');

  (function() {
    QUnit.test('should return the function names of an object', function(assert) {
      assert.expect(1);

      var object = { 'a': 'a', 'b': identity, 'c': /x/, 'd': noop },
          actual = _.functions(object).sort();

      assert.deepEqual(actual, ['b', 'd']);
    });

    QUnit.test('should not include inherited functions', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = identity;
        this.b = 'b';
      }
      Foo.prototype.c = noop;

      assert.deepEqual(_.functions(new Foo), ['a']);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.groupBy');

  (function() {
    var array = [6.1, 4.2, 6.3];

    QUnit.test('should transform keys by `iteratee`', function(assert) {
      assert.expect(1);

      var actual = _.groupBy(array, Math.floor);
      assert.deepEqual(actual, { '4': [4.2], '6': [6.1, 6.3] });
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var array = [6, 4, 6],
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant({ '4': [4], '6':  [6, 6] }));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.groupBy(array, value) : _.groupBy(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var actual = _.groupBy(['one', 'two', 'three'], 'length');
      assert.deepEqual(actual, { '3': ['one', 'two'], '5': ['three'] });
    });

    QUnit.test('should only add values to own, not inherited, properties', function(assert) {
      assert.expect(2);

      var actual = _.groupBy(array, function(n) {
        return Math.floor(n) > 4 ? 'hasOwnProperty' : 'constructor';
      });

      assert.deepEqual(actual.constructor, [4.2]);
      assert.deepEqual(actual.hasOwnProperty, [6.1, 6.3]);
    });

    QUnit.test('should work with a number for `iteratee`', function(assert) {
      assert.expect(2);

      var array = [
        [1, 'a'],
        [2, 'a'],
        [2, 'b']
      ];

      assert.deepEqual(_.groupBy(array, 0), { '1': [[1, 'a']], '2': [[2, 'a'], [2, 'b']] });
      assert.deepEqual(_.groupBy(array, 1), { 'a': [[1, 'a'], [2, 'a']], 'b': [[2, 'b']] });
    });

    QUnit.test('should work with an object for `collection`', function(assert) {
      assert.expect(1);

      var actual = _.groupBy({ 'a': 6.1, 'b': 4.2, 'c': 6.3 }, Math.floor);
      assert.deepEqual(actual, { '4': [4.2], '6': [6.1, 6.3] });
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE).concat(
          lodashStable.range(Math.floor(LARGE_ARRAY_SIZE / 2), LARGE_ARRAY_SIZE),
          lodashStable.range(Math.floor(LARGE_ARRAY_SIZE / 1.5), LARGE_ARRAY_SIZE)
        );

        var iteratee = function(value) { value.push(value[0]); return value; },
            predicate = function(value) { return isEven(value[0]); },
            actual = _(array).groupBy().map(iteratee).filter(predicate).take().value();

        assert.deepEqual(actual, _.take(_.filter(lodashStable.map(_.groupBy(array), iteratee), predicate)));
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.gt');

  (function() {
    QUnit.test('should return `true` if `value` > `other`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.gt(3, 1), true);
      assert.strictEqual(_.gt('def', 'abc'), true);
    });

    QUnit.test('should return `false` if `value` is <= `other`', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.gt(1, 3), false);
      assert.strictEqual(_.gt(3, 3), false);
      assert.strictEqual(_.gt('abc', 'def'), false);
      assert.strictEqual(_.gt('def', 'def'), false);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.gte');

  (function() {
    QUnit.test('should return `true` if `value` >= `other`', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.gte(3, 1), true);
      assert.strictEqual(_.gte(3, 3), true);
      assert.strictEqual(_.gte('def', 'abc'), true);
      assert.strictEqual(_.gte('def', 'def'), true);
    });

    QUnit.test('should return `false` if `value` is less than `other`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.gte(1, 3), false);
      assert.strictEqual(_.gte('abc', 'def'), false);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('has methods');

  lodashStable.each(['has', 'hasIn'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        func = _[methodName],
        isHas = methodName == 'has';

    QUnit.test('`_.' + methodName + '` should check for own properties', function(assert) {
      assert.expect(2);

      var object = { 'a': 1 };

      lodashStable.each(['a', ['a']], function(path) {
        assert.strictEqual(func(object, path), true);
      });
    });

    QUnit.test('`_.' + methodName + '` should not use the `hasOwnProperty` method of the object', function(assert) {
      assert.expect(1);

      var object = { 'hasOwnProperty': null, 'a': 1 };
      assert.strictEqual(func(object, 'a'), true);
    });

    QUnit.test('`_.' + methodName + '` should support deep paths', function(assert) {
      assert.expect(4);

      var object = { 'a': { 'b': 2 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(func(object, path), true);
      });

      lodashStable.each(['a.a', ['a', 'a']], function(path) {
        assert.strictEqual(func(object, path), false);
      });
    });

    QUnit.test('`_.' + methodName + '` should coerce `path` to a string', function(assert) {
      assert.expect(1);

      function fn() {}
      fn.toString = lodashStable.constant('fn');

      var expected = [1, 1, 2, 2, 3, 3, 4, 4],
          objects = [{ 'null': 1 }, { 'undefined': 2 }, { 'fn': 3 }, { '[object Object]': 4 }],
          values = [null, undefined, fn, {}];

      var actual = lodashStable.transform(objects, function(result, object, index) {
        var key = values[index];
        lodashStable.each([key, [key]], function(path) {
          var prop = _.property(key);
          result.push(prop(object));
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with `arguments` objects', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(args, 1), true);
    });

    QUnit.test('`_.' + methodName + '` should work with a non-string `path`', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3];

      lodashStable.each([1, [1]], function(path) {
        assert.strictEqual(func(array, path), true);
      });
    });

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object = { '-0': 'a', '0': 'b' },
          props = [-0, Object(-0), 0, Object(0)],
          expected = lodashStable.map(props, stubTrue);

      var actual = lodashStable.map(props, function(key) {
        return func(object, key);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with a symbol `path`', function(assert) {
      assert.expect(1);

      function Foo() {
        this[symbol] = 1;
      }

      if (Symbol) {
        var symbol2 = Symbol('b');
        Foo.prototype[symbol2] = 2;
        var path = isHas ? symbol : symbol2;

        assert.strictEqual(func(new Foo, path), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should check for a key over a path', function(assert) {
      assert.expect(2);

      var object = { 'a.b': 1 };

      lodashStable.each(['a.b', ['a.b']], function(path) {
        assert.strictEqual(func(object, path), true);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `' + (isHas ? 'false' : 'true') + '` for inherited properties', function(assert) {
      assert.expect(2);

      function Foo() {}
      Foo.prototype.a = 1;

      lodashStable.each(['a', ['a']], function(path) {
        assert.strictEqual(func(new Foo, path), !isHas);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `' + (isHas ? 'false' : 'true') + '` for nested inherited properties', function(assert) {
      assert.expect(2);

      function Foo() {}
      Foo.prototype.a = { 'b': 1 };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(func(new Foo, path), !isHas);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `true` for index values within bounds for arrays, `arguments` objects, and strings', function(assert) {
      assert.expect(2);

      var string = Object('abc');
      delete args[0];
      delete string[0];

      var values = [Array(3), args, string],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        return func(value, 0);
      });

      assert.deepEqual(actual, expected);

      expected = lodashStable.map(values, lodashStable.constant([true, true]));

      actual = lodashStable.map(values, function(value) {
        return lodashStable.map(['a[0]', ['a', '0']], function(path) {
          return func({ 'a': value }, path);
        });
      });

      assert.deepEqual(actual, expected);
      args[0] = 1;
    });

    QUnit.test('`_.' + methodName + '` should return `false` when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [null, undefined],
          expected = lodashStable.map(values, stubFalse);

      lodashStable.each(['constructor', ['constructor']], function(path) {
        var actual = lodashStable.map(values, function(value) {
          return func(value, path);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `false` for deep paths when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [null, undefined],
          expected = lodashStable.map(values, stubFalse);

      lodashStable.each(['constructor.prototype.valueOf', ['constructor', 'prototype', 'valueOf']], function(path) {
        var actual = lodashStable.map(values, function(value) {
          return func(value, path);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `false` for nullish values of nested objects', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubFalse);

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var actual = lodashStable.map(values, function(value, index) {
          var object = index ? { 'a': value } : {};
          return func(object, path);
        });

        assert.deepEqual(actual, expected);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.head');

  (function() {
    var array = [1, 2, 3, 4];

    QUnit.test('should return the first element', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.head(array), 1);
    });

    QUnit.test('should return `undefined` when querying empty arrays', function(assert) {
      assert.expect(1);

      arrayProto[0] = 1;
      assert.strictEqual(_.head([]), undefined);
      arrayProto.length = 0;
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.head);

      assert.deepEqual(actual, [1, 4, 7]);
    });

    QUnit.test('should be aliased', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.first, _.head);
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _(array);
        assert.strictEqual(wrapped.head(), 1);
        assert.strictEqual(wrapped.first(), 1);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _(array).chain();
        assert.ok(wrapped.head() instanceof _);
        assert.ok(wrapped.first() instanceof _);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should not execute immediately when explicitly chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _(array).chain();
        assert.strictEqual(wrapped.head().__wrapped__, array);
        assert.strictEqual(wrapped.first().__wrapped__, array);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var largeArray = lodashStable.range(LARGE_ARRAY_SIZE),
            smallArray = array;

        lodashStable.each(['head', 'first'], function(methodName) {
          lodashStable.times(2, function(index) {
            var array = index ? largeArray : smallArray,
                actual = _(array).filter(isEven)[methodName]();

            assert.strictEqual(actual, _[methodName](_.filter(array, isEven)));
          });
        });
      }
      else {
        skipAssert(assert, 4);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.identity');

  (function() {
    QUnit.test('should return the first argument given', function(assert) {
      assert.expect(1);

      var object = { 'name': 'fred' };
      assert.strictEqual(_.identity(object), object);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.includes');

  (function() {
    lodashStable.each({
      'an `arguments` object': arguments,
      'an array': [1, 2, 3, 4],
      'an object': { 'a': 1, 'b': 2, 'c': 3, 'd': 4 },
      'a string': '1234'
    },
    function(collection, key) {
      QUnit.test('should work with ' + key + ' and  return `true` for  matched values', function(assert) {
        assert.expect(1);

        assert.strictEqual(_.includes(collection, 3), true);
      });

      QUnit.test('should work with ' + key + ' and  return `false` for unmatched values', function(assert) {
        assert.expect(1);

        assert.strictEqual(_.includes(collection, 5), false);
      });

      QUnit.test('should work with ' + key + ' and floor `position` values', function(assert) {
        assert.expect(1);

        assert.strictEqual(_.includes(collection, 2, 1.2), true);
      });

      QUnit.test('should work with ' + key + ' and return an unwrapped value implicitly when chaining', function(assert) {
        assert.expect(1);

        if (!isNpm) {
          assert.strictEqual(_(collection).includes(3), true);
        }
        else {
          skipAssert(assert);
        }
      });

      QUnit.test('should work with ' + key + ' and return a wrapped value when explicitly chaining', function(assert) {
        assert.expect(1);

        if (!isNpm) {
          assert.ok(_(collection).chain().includes(3) instanceof _);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    lodashStable.each({
      'literal': 'abc',
      'object': Object('abc')
    },
    function(collection, key) {
      QUnit.test('should work with a string ' + key + ' for `collection`', function(assert) {
        assert.expect(2);

        assert.strictEqual(_.includes(collection, 'bc'), true);
        assert.strictEqual(_.includes(collection, 'd'), false);
      });
    });

    QUnit.test('should return `false` for empty collections', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, stubFalse);

      var actual = lodashStable.map(empties, function(value) {
        try {
          return _.includes(value);
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with a string and a `fromIndex` >= `length`', function(assert) {
      assert.expect(1);

      var string = '1234',
          length = string.length,
          indexes = [4, 6, Math.pow(2, 32), Infinity];

      var expected = lodashStable.map(indexes, function(index) {
        return [false, false, index == length];
      });

      var actual = lodashStable.map(indexes, function(fromIndex) {
        return [
          _.includes(string, 1, fromIndex),
          _.includes(string, undefined, fromIndex),
          _.includes(string, '', fromIndex)
        ];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should match `NaN`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.includes([1, NaN, 3], NaN), true);
    });

    QUnit.test('should match `-0` as `0`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.includes([-0], 0), true);
      assert.strictEqual(_.includes([0], -0), true);
    });

    QUnit.test('should work as an iteratee for methods like `_.every`', function(assert) {
      assert.expect(1);

      var array = [2, 3, 1],
          values = [1, 2, 3];

      assert.ok(lodashStable.every(values, lodashStable.partial(_.includes, array)));
    });
  }(1, 2, 3, 4));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.initial');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should accept a falsey `array` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubArray);

      var actual = lodashStable.map(falsey, function(array, index) {
        try {
          return index ? _.initial(array) : _.initial();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should exclude last element', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.initial(array), [1, 2]);
    });

    QUnit.test('should return an empty when querying empty arrays', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.initial([]), []);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.initial);

      assert.deepEqual(actual, [[1, 2], [4, 5], [7, 8]]);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            values = [];

        var actual = _(array).initial().filter(function(value) {
          values.push(value);
          return false;
        })
        .value();

        assert.deepEqual(actual, []);
        assert.deepEqual(values, _.initial(array));

        values = [];

        actual = _(array).filter(function(value) {
          values.push(value);
          return isEven(value);
        })
        .initial()
        .value();

        assert.deepEqual(actual, _.initial(lodashStable.filter(array, isEven)));
        assert.deepEqual(values, array);
      }
      else {
        skipAssert(assert, 4);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.inRange');

  (function() {
    QUnit.test('should work with an `end` argument', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.inRange(3, 5), true);
      assert.strictEqual(_.inRange(5, 5), false);
      assert.strictEqual(_.inRange(6, 5), false);
    });

    QUnit.test('should work with `start` and `end` arguments', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.inRange(1, 1, 5), true);
      assert.strictEqual(_.inRange(3, 1, 5), true);
      assert.strictEqual(_.inRange(0, 1, 5), false);
      assert.strictEqual(_.inRange(5, 1, 5), false);
    });

    QUnit.test('should treat falsey `start` arguments as `0`', function(assert) {
      assert.expect(13);

      lodashStable.each(falsey, function(value, index) {
        if (index) {
          assert.strictEqual(_.inRange(0, value), false);
          assert.strictEqual(_.inRange(0, value, 1), true);
        } else {
          assert.strictEqual(_.inRange(0), false);
        }
      });
    });

    QUnit.test('should swap `start` and `end` when `start` > `end`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.inRange(2, 5, 1), true);
      assert.strictEqual(_.inRange(-3, -2, -6), true);
    });

    QUnit.test('should work with a floating point `n` value', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.inRange(0.5, 5), true);
      assert.strictEqual(_.inRange(1.2, 1, 5), true);
      assert.strictEqual(_.inRange(5.2, 5), false);
      assert.strictEqual(_.inRange(0.5, 1, 5), false);
    });

    QUnit.test('should coerce arguments to finite numbers', function(assert) {
      assert.expect(1);

      var actual = [
        _.inRange(0, '1'),
        _.inRange(0, '0', 1),
        _.inRange(0, 0, '1'),
        _.inRange(0, NaN, 1),
        _.inRange(-1, -1, NaN)
      ];

      assert.deepEqual(actual, lodashStable.map(actual, stubTrue));
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('intersection methods');

  lodashStable.each(['intersection', 'intersectionBy', 'intersectionWith'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        func = _[methodName];

    QUnit.test('`_.' + methodName + '` should return the intersection of two arrays', function(assert) {
      assert.expect(1);

      var actual = func([2, 1], [2, 3]);
      assert.deepEqual(actual, [2]);
    });

    QUnit.test('`_.' + methodName + '` should return the intersection of multiple arrays', function(assert) {
      assert.expect(1);

      var actual = func([2, 1, 2, 3], [3, 4], [3, 2]);
      assert.deepEqual(actual, [3]);
    });

    QUnit.test('`_.' + methodName + '` should return an array of unique values', function(assert) {
      assert.expect(1);

      var actual = func([1, 1, 3, 2, 2], [5, 2, 2, 1, 4], [2, 1, 1]);
      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('`_.' + methodName + '` should work with a single array', function(assert) {
      assert.expect(1);

      var actual = func([1, 1, 3, 2, 2]);
      assert.deepEqual(actual, [1, 3, 2]);
    });

    QUnit.test('`_.' + methodName + '` should work with `arguments` objects', function(assert) {
      assert.expect(2);

      var array = [0, 1, null, 3],
          expected = [1, 3];

      assert.deepEqual(func(array, args), expected);
      assert.deepEqual(func(args, array), expected);
    });

    QUnit.test('`_.' + methodName + '` should treat `-0` as `0`', function(assert) {
      assert.expect(1);

      var values = [-0, 0],
          expected = lodashStable.map(values, lodashStable.constant(['0']));

      var actual = lodashStable.map(values, function(value) {
        return lodashStable.map(func(values, [value]), lodashStable.toString);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should match `NaN`', function(assert) {
      assert.expect(1);

      var actual = func([1, NaN, 3], [NaN, 5, NaN]);
      assert.deepEqual(actual, [NaN]);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of `-0` as `0`', function(assert) {
      assert.expect(1);

      var values = [-0, 0],
          expected = lodashStable.map(values, lodashStable.constant(['0']));

      var actual = lodashStable.map(values, function(value) {
        var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, lodashStable.constant(value));
        return lodashStable.map(func(values, largeArray), lodashStable.toString);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of `NaN`', function(assert) {
      assert.expect(1);

      var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, stubNaN);
      assert.deepEqual(func([1, NaN, 3], largeArray), [NaN]);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of objects', function(assert) {
      assert.expect(2);

      var object = {},
          largeArray = lodashStable.times(LARGE_ARRAY_SIZE, lodashStable.constant(object));

      assert.deepEqual(func([object], largeArray), [object]);
      assert.deepEqual(func(lodashStable.range(LARGE_ARRAY_SIZE), [1]), [1]);
    });

    QUnit.test('`_.' + methodName + '` should treat values that are not arrays or `arguments` objects as empty', function(assert) {
      assert.expect(3);

      var array = [0, 1, null, 3];
      assert.deepEqual(func(array, 3, { '0': 1 }, null), []);
      assert.deepEqual(func(null, array, null, [2, 3]), []);
      assert.deepEqual(func(array, null, args, null), []);
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _([1, 3, 2])[methodName]([5, 2, 1, 4]);
        assert.ok(wrapped instanceof _);
        assert.deepEqual(wrapped.value(), [1, 2]);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.intersectionBy');

  (function() {
    QUnit.test('should accept an `iteratee` argument', function(assert) {
      assert.expect(2);

      var actual = _.intersectionBy([2.1, 1.2], [2.3, 3.4], Math.floor);
      assert.deepEqual(actual, [2.1]);

      actual = _.intersectionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
      assert.deepEqual(actual, [{ 'x': 1 }]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.intersectionBy([2.1, 1.2], [2.3, 3.4], function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [2.3]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.intersectionWith');

  (function() {
    QUnit.test('should work with a `comparator` argument', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }],
          others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }],
          actual = _.intersectionWith(objects, others, lodashStable.isEqual);

      assert.deepEqual(actual, [objects[0]]);
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var array = [-0],
          largeArray = lodashStable.times(LARGE_ARRAY_SIZE, stubZero),
          others = [[0], largeArray],
          expected = lodashStable.map(others, lodashStable.constant(['-0']));

      var actual = lodashStable.map(others, function(other) {
        return lodashStable.map(_.intersectionWith(array, other, lodashStable.eq), lodashStable.toString);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.invert');

  (function() {
    QUnit.test('should invert an object', function(assert) {
      assert.expect(2);

      var object = { 'a': 1, 'b': 2 },
          actual = _.invert(object);

      assert.deepEqual(actual, { '1': 'a', '2': 'b' });
      assert.deepEqual(_.invert(actual), { 'a': '1', 'b': '2' });
    });

    QUnit.test('should work with values that shadow keys on `Object.prototype`', function(assert) {
      assert.expect(1);

      var object = { 'a': 'hasOwnProperty', 'b': 'constructor' };
      assert.deepEqual(_.invert(object), { 'hasOwnProperty': 'a', 'constructor': 'b' });
    });

    QUnit.test('should work with an object that has a `length` property', function(assert) {
      assert.expect(1);

      var object = { '0': 'a', '1': 'b', 'length': 2 };
      assert.deepEqual(_.invert(object), { 'a': '0', 'b': '1', '2': 'length' });
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var object = { 'a': 1, 'b': 2 },
            wrapped = _(object).invert();

        assert.ok(wrapped instanceof _);
        assert.deepEqual(wrapped.value(), { '1': 'a', '2': 'b' });
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.invertBy');

  (function() {
    var object = { 'a': 1, 'b': 2, 'c': 1 };

    QUnit.test('should transform keys by `iteratee`', function(assert) {
      assert.expect(1);

      var expected = { 'group1': ['a', 'c'], 'group2': ['b'] };

      var actual = _.invertBy(object, function(value) {
        return 'group' + value;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant({ '1': ['a', 'c'], '2': ['b'] }));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.invertBy(object, value) : _.invertBy(object);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should only add multiple values to own, not inherited, properties', function(assert) {
      assert.expect(1);

      var object = { 'a': 'hasOwnProperty', 'b': 'constructor' },
          expected = { 'hasOwnProperty': ['a'], 'constructor': ['b'] };

      assert.ok(lodashStable.isEqual(_.invertBy(object), expected));
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _(object).invertBy();

        assert.ok(wrapped instanceof _);
        assert.deepEqual(wrapped.value(), { '1': ['a', 'c'], '2': ['b'] });
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.invoke');

  (function() {
    QUnit.test('should invoke a method on `object`', function(assert) {
      assert.expect(1);

      var object = { 'a': lodashStable.constant('A') },
          actual = _.invoke(object, 'a');

      assert.strictEqual(actual, 'A');
    });

    QUnit.test('should support invoking with arguments', function(assert) {
      assert.expect(1);

      var object = { 'a': function(a, b) { return [a, b]; } },
          actual = _.invoke(object, 'a', 1, 2);

      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('should not error on nullish elements', function(assert) {
      assert.expect(1);

      var values = [null, undefined],
          expected = lodashStable.map(values, noop);

      var actual = lodashStable.map(values, function(value) {
        try {
          return _.invoke(value, 'a.b', 1, 2);
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object = { '-0': stubA, '0': stubB },
          props = [-0, Object(-0), 0, Object(0)];

      var actual = lodashStable.map(props, function(key) {
        return _.invoke(object, key);
      });

      assert.deepEqual(actual, ['a', 'a', 'b', 'b']);
    });

    QUnit.test('should support deep paths', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': function(a, b) { return [a, b]; } } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var actual = _.invoke(object, path, 1, 2);
        assert.deepEqual(actual, [1, 2]);
      });
    });

    QUnit.test('should invoke deep property methods with the correct `this` binding', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': function() { return this.c; }, 'c': 1 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.deepEqual(_.invoke(object, path), 1);
      });
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var object = { 'a': stubOne };
        assert.strictEqual(_(object).invoke('a'), 1);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var object = { 'a': stubOne };
        assert.ok(_(object).chain().invoke('a') instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.invokeMap');

  (function() {
    QUnit.test('should invoke a methods on each element of `collection`', function(assert) {
      assert.expect(1);

      var array = ['a', 'b', 'c'],
          actual = _.invokeMap(array, 'toUpperCase');

      assert.deepEqual(actual, ['A', 'B', 'C']);
    });

    QUnit.test('should support invoking with arguments', function(assert) {
      assert.expect(1);

      var array = [function() { return slice.call(arguments); }],
          actual = _.invokeMap(array, 'call', null, 'a', 'b', 'c');

      assert.deepEqual(actual, [['a', 'b', 'c']]);
    });

    QUnit.test('should work with a function for `methodName`', function(assert) {
      assert.expect(1);

      var array = ['a', 'b', 'c'];

      var actual = _.invokeMap(array, function(left, right) {
        return left + this.toUpperCase() + right;
      }, '(', ')');

      assert.deepEqual(actual, ['(A)', '(B)', '(C)']);
    });

    QUnit.test('should work with an object for `collection`', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2, 'c': 3 },
          actual = _.invokeMap(object, 'toFixed', 1);

      assert.deepEqual(actual, ['1.0', '2.0', '3.0']);
    });

    QUnit.test('should treat number values for `collection` as empty', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.invokeMap(1), []);
    });

    QUnit.test('should not error on nullish elements', function(assert) {
      assert.expect(1);

      var array = ['a', null, undefined, 'd'];

      try {
        var actual = _.invokeMap(array, 'toUpperCase');
      } catch (e) {}

      assert.deepEqual(actual, ['A', undefined, undefined, 'D']);
    });

    QUnit.test('should not error on elements with missing properties', function(assert) {
      assert.expect(1);

      var objects = lodashStable.map([null, undefined, stubOne], function(value) {
        return { 'a': value };
      });

      var expected = lodashStable.map(objects, function(object) {
        return object.a ? object.a() : undefined;
      });

      try {
        var actual = _.invokeMap(objects, 'a');
      } catch (e) {}

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should invoke deep property methods with the correct `this` binding', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': function() { return this.c; }, 'c': 1 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.deepEqual(_.invokeMap([object], path), [1]);
      });
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var array = ['a', 'b', 'c'],
            wrapped = _(array),
            actual = wrapped.invokeMap('toUpperCase');

        assert.ok(actual instanceof _);
        assert.deepEqual(actual.valueOf(), ['A', 'B', 'C']);

        actual = wrapped.invokeMap(function(left, right) {
          return left + this.toUpperCase() + right;
        }, '(', ')');

        assert.ok(actual instanceof _);
        assert.deepEqual(actual.valueOf(), ['(A)', '(B)', '(C)']);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should support shortcut fusion', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var count = 0,
            method = function() { count++; return this.index; };

        var array = lodashStable.times(LARGE_ARRAY_SIZE, function(index) {
          return { 'index': index, 'method': method };
        });

        var actual = _(array).invokeMap('method').take(1).value();

        assert.strictEqual(count, 1);
        assert.deepEqual(actual, [0]);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isArguments');

  (function() {
    var args = (function() { return arguments; }(1, 2, 3)),
        strictArgs = (function() { 'use strict'; return arguments; }(1, 2, 3));

    QUnit.test('should return `true` for `arguments` objects', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.isArguments(args), true);
      assert.strictEqual(_.isArguments(strictArgs), true);
    });

    QUnit.test('should return `false` for non `arguments` objects', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isArguments(value) : _.isArguments();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isArguments([1, 2, 3]), false);
      assert.strictEqual(_.isArguments(true), false);
      assert.strictEqual(_.isArguments(new Date), false);
      assert.strictEqual(_.isArguments(new Error), false);
      assert.strictEqual(_.isArguments(_), false);
      assert.strictEqual(_.isArguments(slice), false);
      assert.strictEqual(_.isArguments({ '0': 1, 'callee': noop, 'length': 1 }), false);
      assert.strictEqual(_.isArguments(1), false);
      assert.strictEqual(_.isArguments(/x/), false);
      assert.strictEqual(_.isArguments('a'), false);
      assert.strictEqual(_.isArguments(symbol), false);
    });

    QUnit.test('should work with an `arguments` object from another realm', function(assert) {
      assert.expect(1);

      if (realm.arguments) {
        assert.strictEqual(_.isArguments(realm.arguments), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isArray');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for arrays', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isArray([1, 2, 3]), true);
    });

    QUnit.test('should return `false` for non-arrays', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isArray(value) : _.isArray();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isArray(args), false);
      assert.strictEqual(_.isArray(true), false);
      assert.strictEqual(_.isArray(new Date), false);
      assert.strictEqual(_.isArray(new Error), false);
      assert.strictEqual(_.isArray(_), false);
      assert.strictEqual(_.isArray(slice), false);
      assert.strictEqual(_.isArray({ '0': 1, 'length': 1 }), false);
      assert.strictEqual(_.isArray(1), false);
      assert.strictEqual(_.isArray(/x/), false);
      assert.strictEqual(_.isArray('a'), false);
      assert.strictEqual(_.isArray(symbol), false);
    });

    QUnit.test('should work with an array from another realm', function(assert) {
      assert.expect(1);

      if (realm.array) {
        assert.strictEqual(_.isArray(realm.array), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isArrayBuffer');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for array buffers', function(assert) {
      assert.expect(1);

      if (ArrayBuffer) {
        assert.strictEqual(_.isArrayBuffer(arrayBuffer), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non array buffers', function(assert) {
      assert.expect(13);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isArrayBuffer(value) : _.isArrayBuffer();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isArrayBuffer(args), false);
      assert.strictEqual(_.isArrayBuffer([1, 2, 3]), false);
      assert.strictEqual(_.isArrayBuffer(true), false);
      assert.strictEqual(_.isArrayBuffer(new Date), false);
      assert.strictEqual(_.isArrayBuffer(new Error), false);
      assert.strictEqual(_.isArrayBuffer(_), false);
      assert.strictEqual(_.isArrayBuffer(slice), false);
      assert.strictEqual(_.isArrayBuffer({ 'a': 1 }), false);
      assert.strictEqual(_.isArrayBuffer(1), false);
      assert.strictEqual(_.isArrayBuffer(/x/), false);
      assert.strictEqual(_.isArrayBuffer('a'), false);
      assert.strictEqual(_.isArrayBuffer(symbol), false);
    });

    QUnit.test('should work with array buffers from another realm', function(assert) {
      assert.expect(1);

      if (realm.arrayBuffer) {
        assert.strictEqual(_.isArrayBuffer(realm.arrayBuffer), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isArrayLike');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for array-like values', function(assert) {
      assert.expect(1);

      var values = [args, [1, 2, 3], { '0': 'a', 'length': 1 }, 'a'],
          expected = lodashStable.map(values, stubTrue),
          actual = lodashStable.map(values, _.isArrayLike);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non-arrays', function(assert) {
      assert.expect(11);

      var expected = lodashStable.map(falsey, function(value) {
        return value === '';
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isArrayLike(value) : _.isArrayLike();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isArrayLike(true), false);
      assert.strictEqual(_.isArrayLike(new Date), false);
      assert.strictEqual(_.isArrayLike(new Error), false);
      assert.strictEqual(_.isArrayLike(_), false);
      assert.strictEqual(_.isArrayLike(generator), false);
      assert.strictEqual(_.isArrayLike(slice), false);
      assert.strictEqual(_.isArrayLike({ 'a': 1 }), false);
      assert.strictEqual(_.isArrayLike(1), false);
      assert.strictEqual(_.isArrayLike(/x/), false);
      assert.strictEqual(_.isArrayLike(symbol), false);
    });

    QUnit.test('should work with an array from another realm', function(assert) {
      assert.expect(1);

      if (realm.object) {
        var values = [realm.arguments, realm.array, realm.string],
            expected = lodashStable.map(values, stubTrue),
            actual = lodashStable.map(values, _.isArrayLike);

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isBoolean');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for booleans', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.isBoolean(true), true);
      assert.strictEqual(_.isBoolean(false), true);
      assert.strictEqual(_.isBoolean(Object(true)), true);
      assert.strictEqual(_.isBoolean(Object(false)), true);
    });

    QUnit.test('should return `false` for non-booleans', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, function(value) {
        return value === false;
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isBoolean(value) : _.isBoolean();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isBoolean(args), false);
      assert.strictEqual(_.isBoolean([1, 2, 3]), false);
      assert.strictEqual(_.isBoolean(new Date), false);
      assert.strictEqual(_.isBoolean(new Error), false);
      assert.strictEqual(_.isBoolean(_), false);
      assert.strictEqual(_.isBoolean(slice), false);
      assert.strictEqual(_.isBoolean({ 'a': 1 }), false);
      assert.strictEqual(_.isBoolean(1), false);
      assert.strictEqual(_.isBoolean(/x/), false);
      assert.strictEqual(_.isBoolean('a'), false);
      assert.strictEqual(_.isBoolean(symbol), false);
    });

    QUnit.test('should work with a boolean from another realm', function(assert) {
      assert.expect(1);

      if (realm.boolean) {
        assert.strictEqual(_.isBoolean(realm.boolean), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isBuffer');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for buffers', function(assert) {
      assert.expect(1);

      if (Buffer) {
        assert.strictEqual(_.isBuffer(new Buffer(2)), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non-buffers', function(assert) {
      assert.expect(13);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isBuffer(value) : _.isBuffer();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isBuffer(args), false);
      assert.strictEqual(_.isBuffer([1, 2, 3]), false);
      assert.strictEqual(_.isBuffer(true), false);
      assert.strictEqual(_.isBuffer(new Date), false);
      assert.strictEqual(_.isBuffer(new Error), false);
      assert.strictEqual(_.isBuffer(_), false);
      assert.strictEqual(_.isBuffer(slice), false);
      assert.strictEqual(_.isBuffer({ 'a': 1 }), false);
      assert.strictEqual(_.isBuffer(1), false);
      assert.strictEqual(_.isBuffer(/x/), false);
      assert.strictEqual(_.isBuffer('a'), false);
      assert.strictEqual(_.isBuffer(symbol), false);
    });

    QUnit.test('should return `false` if `Buffer` is not defined', function(assert) {
      assert.expect(1);

      if (!isStrict && Buffer && lodashBizarro) {
        assert.strictEqual(lodashBizarro.isBuffer(new Buffer(2)), false);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isDate');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for dates', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isDate(new Date), true);
    });

    QUnit.test('should return `false` for non-dates', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isDate(value) : _.isDate();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isDate(args), false);
      assert.strictEqual(_.isDate([1, 2, 3]), false);
      assert.strictEqual(_.isDate(true), false);
      assert.strictEqual(_.isDate(new Error), false);
      assert.strictEqual(_.isDate(_), false);
      assert.strictEqual(_.isDate(slice), false);
      assert.strictEqual(_.isDate({ 'a': 1 }), false);
      assert.strictEqual(_.isDate(1), false);
      assert.strictEqual(_.isDate(/x/), false);
      assert.strictEqual(_.isDate('a'), false);
      assert.strictEqual(_.isDate(symbol), false);
    });

    QUnit.test('should work with a date object from another realm', function(assert) {
      assert.expect(1);

      if (realm.date) {
        assert.strictEqual(_.isDate(realm.date), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isElement');

  (function() {
    var args = arguments;

    function Element() {
      this.nodeType = 1;
    }

    QUnit.test('should return `false` for plain objects', function(assert) {
      assert.expect(7);

      var element = body || new Element;

      assert.strictEqual(_.isElement(element), true);
      assert.strictEqual(_.isElement({ 'nodeType': 1 }), false);
      assert.strictEqual(_.isElement({ 'nodeType': Object(1) }), false);
      assert.strictEqual(_.isElement({ 'nodeType': true }), false);
      assert.strictEqual(_.isElement({ 'nodeType': [1] }), false);
      assert.strictEqual(_.isElement({ 'nodeType': '1' }), false);
      assert.strictEqual(_.isElement({ 'nodeType': '001' }), false);
    });

    QUnit.test('should return `false` for non DOM elements', function(assert) {
      assert.expect(13);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isElement(value) : _.isElement();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isElement(args), false);
      assert.strictEqual(_.isElement([1, 2, 3]), false);
      assert.strictEqual(_.isElement(true), false);
      assert.strictEqual(_.isElement(new Date), false);
      assert.strictEqual(_.isElement(new Error), false);
      assert.strictEqual(_.isElement(_), false);
      assert.strictEqual(_.isElement(slice), false);
      assert.strictEqual(_.isElement({ 'a': 1 }), false);
      assert.strictEqual(_.isElement(1), false);
      assert.strictEqual(_.isElement(/x/), false);
      assert.strictEqual(_.isElement('a'), false);
      assert.strictEqual(_.isElement(symbol), false);
    });

    QUnit.test('should work with a DOM element from another realm', function(assert) {
      assert.expect(1);

      if (realm.element) {
        assert.strictEqual(_.isElement(realm.element), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isEmpty');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for empty values', function(assert) {
      assert.expect(10);

      var expected = lodashStable.map(empties, stubTrue),
          actual = lodashStable.map(empties, _.isEmpty);

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isEmpty(true), true);
      assert.strictEqual(_.isEmpty(slice), true);
      assert.strictEqual(_.isEmpty(1), true);
      assert.strictEqual(_.isEmpty(NaN), true);
      assert.strictEqual(_.isEmpty(/x/), true);
      assert.strictEqual(_.isEmpty(symbol), true);
      assert.strictEqual(_.isEmpty(), true);

      if (Buffer) {
        assert.strictEqual(_.isEmpty(new Buffer(0)), true);
        assert.strictEqual(_.isEmpty(new Buffer(1)), false);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should return `false` for non-empty values', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.isEmpty([0]), false);
      assert.strictEqual(_.isEmpty({ 'a': 0 }), false);
      assert.strictEqual(_.isEmpty('a'), false);
    });

    QUnit.test('should work with an object that has a `length` property', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isEmpty({ 'length': 0 }), false);
    });

    QUnit.test('should work with `arguments` objects', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isEmpty(args), false);
    });

    QUnit.test('should work with jQuery/MooTools DOM query collections', function(assert) {
      assert.expect(1);

      function Foo(elements) {
        push.apply(this, elements);
      }
      Foo.prototype = { 'length': 0, 'splice': arrayProto.splice };

      assert.strictEqual(_.isEmpty(new Foo([])), true);
    });

    QUnit.test('should work with maps', function(assert) {
      assert.expect(4);

      if (Map) {
        lodashStable.each([new Map, realm.map], function(map) {
          assert.strictEqual(_.isEmpty(map), true);
          map.set('a', 1);
          assert.strictEqual(_.isEmpty(map), false);
          map.clear();
        });
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should work with sets', function(assert) {
      assert.expect(4);

      if (Set) {
        lodashStable.each([new Set, realm.set], function(set) {
          assert.strictEqual(_.isEmpty(set), true);
          set.add(1);
          assert.strictEqual(_.isEmpty(set), false);
          set.clear();
        });
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should not treat objects with negative lengths as array-like', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.prototype.length = -1;

      assert.strictEqual(_.isEmpty(new Foo), true);
    });

    QUnit.test('should not treat objects with lengths larger than `MAX_SAFE_INTEGER` as array-like', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.prototype.length = MAX_SAFE_INTEGER + 1;

      assert.strictEqual(_.isEmpty(new Foo), true);
    });

    QUnit.test('should not treat objects with non-number lengths as array-like', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isEmpty({ 'length': '0' }), false);
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.strictEqual(_({}).isEmpty(), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_({}).chain().isEmpty() instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isEqual');

  (function() {
    var symbol1 = Symbol ? Symbol('a') : true,
        symbol2 = Symbol ? Symbol('b') : false;

    QUnit.test('should compare primitives', function(assert) {
      assert.expect(1);

      var pairs = [
        [1, 1, true], [1, Object(1), true], [1, '1', false], [1, 2, false],
        [-0, -0, true], [0, 0, true], [0, Object(0), true], [Object(0), Object(0), true], [-0, 0, true], [0, '0', false], [0, null, false],
        [NaN, NaN, true], [NaN, Object(NaN), true], [Object(NaN), Object(NaN), true], [NaN, 'a', false], [NaN, Infinity, false],
        ['a', 'a', true], ['a', Object('a'), true], [Object('a'), Object('a'), true], ['a', 'b', false], ['a', ['a'], false],
        [true, true, true], [true, Object(true), true], [Object(true), Object(true), true], [true, 1, false], [true, 'a', false],
        [false, false, true], [false, Object(false), true], [Object(false), Object(false), true], [false, 0, false], [false, '', false],
        [symbol1, symbol1, true], [symbol1, Object(symbol1), true], [Object(symbol1), Object(symbol1), true], [symbol1, symbol2, false],
        [null, null, true], [null, undefined, false], [null, {}, false], [null, '', false],
        [undefined, undefined, true], [undefined, null, false], [undefined, '', false]
      ];

      var expected = lodashStable.map(pairs, function(pair) {
        return pair[2];
      });

      var actual = lodashStable.map(pairs, function(pair) {
        return _.isEqual(pair[0], pair[1]);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should compare arrays', function(assert) {
      assert.expect(6);

      var array1 = [true, null, 1, 'a', undefined],
          array2 = [true, null, 1, 'a', undefined];

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1 = [[1, 2, 3], new Date(2012, 4, 23), /x/, { 'e': 1 }];
      array2 = [[1, 2, 3], new Date(2012, 4, 23), /x/, { 'e': 1 }];

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1 = [1];
      array1[2] = 3;

      array2 = [1];
      array2[1] = undefined;
      array2[2] = 3;

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1 = [Object(1), false, Object('a'), /x/, new Date(2012, 4, 23), ['a', 'b', [Object('c')]], { 'a': 1 }];
      array2 = [1, Object(false), 'a', /x/, new Date(2012, 4, 23), ['a', Object('b'), ['c']], { 'a': 1 }];

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1 = [1, 2, 3];
      array2 = [3, 2, 1];

      assert.strictEqual(_.isEqual(array1, array2), false);

      array1 = [1, 2];
      array2 = [1, 2, 3];

      assert.strictEqual(_.isEqual(array1, array2), false);
    });

    QUnit.test('should treat arrays with identical values but different non-index properties as equal', function(assert) {
      assert.expect(3);

      var array1 = [1, 2, 3],
          array2 = [1, 2, 3];

      array1.every = array1.filter = array1.forEach =
      array1.indexOf = array1.lastIndexOf = array1.map =
      array1.some = array1.reduce = array1.reduceRight = null;

      array2.concat = array2.join = array2.pop =
      array2.reverse = array2.shift = array2.slice =
      array2.sort = array2.splice = array2.unshift = null;

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1 = [1, 2, 3];
      array1.a = 1;

      array2 = [1, 2, 3];
      array2.b = 1;

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1 = /c/.exec('abcde');
      array2 = ['c'];

      assert.strictEqual(_.isEqual(array1, array2), true);
    });

    QUnit.test('should compare sparse arrays', function(assert) {
      assert.expect(3);

      var array = Array(1);

      assert.strictEqual(_.isEqual(array, Array(1)), true);
      assert.strictEqual(_.isEqual(array, [undefined]), true);
      assert.strictEqual(_.isEqual(array, Array(2)), false);
    });

    QUnit.test('should compare plain objects', function(assert) {
      assert.expect(5);

      var object1 = { 'a': true, 'b': null, 'c': 1, 'd': 'a', 'e': undefined },
          object2 = { 'a': true, 'b': null, 'c': 1, 'd': 'a', 'e': undefined };

      assert.strictEqual(_.isEqual(object1, object2), true);

      object1 = { 'a': [1, 2, 3], 'b': new Date(2012, 4, 23), 'c': /x/, 'd': { 'e': 1 } };
      object2 = { 'a': [1, 2, 3], 'b': new Date(2012, 4, 23), 'c': /x/, 'd': { 'e': 1 } };

      assert.strictEqual(_.isEqual(object1, object2), true);

      object1 = { 'a': 1, 'b': 2, 'c': 3 };
      object2 = { 'a': 3, 'b': 2, 'c': 1 };

      assert.strictEqual(_.isEqual(object1, object2), false);

      object1 = { 'a': 1, 'b': 2, 'c': 3 };
      object2 = { 'd': 1, 'e': 2, 'f': 3 };

      assert.strictEqual(_.isEqual(object1, object2), false);

      object1 = { 'a': 1, 'b': 2 };
      object2 = { 'a': 1, 'b': 2, 'c': 3 };

      assert.strictEqual(_.isEqual(object1, object2), false);
    });

    QUnit.test('should compare objects regardless of key order', function(assert) {
      assert.expect(1);

      var object1 = { 'a': 1, 'b': 2, 'c': 3 },
          object2 = { 'c': 3, 'a': 1, 'b': 2 };

      assert.strictEqual(_.isEqual(object1, object2), true);
    });

    QUnit.test('should compare nested objects', function(assert) {
      assert.expect(1);

      var object1 = {
        'a': [1, 2, 3],
        'b': true,
        'c': Object(1),
        'd': 'a',
        'e': {
          'f': ['a', Object('b'), 'c'],
          'g': Object(false),
          'h': new Date(2012, 4, 23),
          'i': noop,
          'j': 'a'
        }
      };

      var object2 = {
        'a': [1, Object(2), 3],
        'b': Object(true),
        'c': 1,
        'd': Object('a'),
        'e': {
          'f': ['a', 'b', 'c'],
          'g': false,
          'h': new Date(2012, 4, 23),
          'i': noop,
          'j': 'a'
        }
      };

      assert.strictEqual(_.isEqual(object1, object2), true);
    });

    QUnit.test('should compare object instances', function(assert) {
      assert.expect(4);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.a = 1;

      function Bar() {
        this.a = 1;
      }
      Bar.prototype.a = 2;

      assert.strictEqual(_.isEqual(new Foo, new Foo), true);
      assert.strictEqual(_.isEqual(new Foo, new Bar), false);
      assert.strictEqual(_.isEqual({ 'a': 1 }, new Foo), false);
      assert.strictEqual(_.isEqual({ 'a': 2 }, new Bar), false);
    });

    QUnit.test('should compare objects with constructor properties', function(assert) {
      assert.expect(5);

      assert.strictEqual(_.isEqual({ 'constructor': 1 },   { 'constructor': 1 }), true);
      assert.strictEqual(_.isEqual({ 'constructor': 1 },   { 'constructor': '1' }), false);
      assert.strictEqual(_.isEqual({ 'constructor': [1] }, { 'constructor': [1] }), true);
      assert.strictEqual(_.isEqual({ 'constructor': [1] }, { 'constructor': ['1'] }), false);
      assert.strictEqual(_.isEqual({ 'constructor': Object }, {}), false);
    });

    QUnit.test('should compare arrays with circular references', function(assert) {
      assert.expect(4);

      var array1 = [],
          array2 = [];

      array1.push(array1);
      array2.push(array2);

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1.push('b');
      array2.push('b');

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1.push('c');
      array2.push('d');

      assert.strictEqual(_.isEqual(array1, array2), false);

      array1 = ['a', 'b', 'c'];
      array1[1] = array1;
      array2 = ['a', ['a', 'b', 'c'], 'c'];

      assert.strictEqual(_.isEqual(array1, array2), false);
    });

    QUnit.test('should have transitive equivalence for circular references of arrays', function(assert) {
      assert.expect(3);

      var array1 = [],
          array2 = [array1],
          array3 = [array2];

      array1[0] = array1;

      assert.strictEqual(_.isEqual(array1, array2), true);
      assert.strictEqual(_.isEqual(array2, array3), true);
      assert.strictEqual(_.isEqual(array1, array3), true);
    });

    QUnit.test('should compare objects with circular references', function(assert) {
      assert.expect(4);

      var object1 = {},
          object2 = {};

      object1.a = object1;
      object2.a = object2;

      assert.strictEqual(_.isEqual(object1, object2), true);

      object1.b = 0;
      object2.b = Object(0);

      assert.strictEqual(_.isEqual(object1, object2), true);

      object1.c = Object(1);
      object2.c = Object(2);

      assert.strictEqual(_.isEqual(object1, object2), false);

      object1 = { 'a': 1, 'b': 2, 'c': 3 };
      object1.b = object1;
      object2 = { 'a': 1, 'b': { 'a': 1, 'b': 2, 'c': 3 }, 'c': 3 };

      assert.strictEqual(_.isEqual(object1, object2), false);
    });

    QUnit.test('should have transitive equivalence for circular references of objects', function(assert) {
      assert.expect(3);

      var object1 = {},
          object2 = { 'a': object1 },
          object3 = { 'a': object2 };

      object1.a = object1;

      assert.strictEqual(_.isEqual(object1, object2), true);
      assert.strictEqual(_.isEqual(object2, object3), true);
      assert.strictEqual(_.isEqual(object1, object3), true);
    });

    QUnit.test('should compare objects with multiple circular references', function(assert) {
      assert.expect(3);

      var array1 = [{}],
          array2 = [{}];

      (array1[0].a = array1).push(array1);
      (array2[0].a = array2).push(array2);

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1[0].b = 0;
      array2[0].b = Object(0);

      assert.strictEqual(_.isEqual(array1, array2), true);

      array1[0].c = Object(1);
      array2[0].c = Object(2);

      assert.strictEqual(_.isEqual(array1, array2), false);
    });

    QUnit.test('should compare objects with complex circular references', function(assert) {
      assert.expect(1);

      var object1 = {
        'foo': { 'b': { 'c': { 'd': {} } } },
        'bar': { 'a': 2 }
      };

      var object2 = {
        'foo': { 'b': { 'c': { 'd': {} } } },
        'bar': { 'a': 2 }
      };

      object1.foo.b.c.d = object1;
      object1.bar.b = object1.foo.b;

      object2.foo.b.c.d = object2;
      object2.bar.b = object2.foo.b;

      assert.strictEqual(_.isEqual(object1, object2), true);
    });

    QUnit.test('should compare objects with shared property values', function(assert) {
      assert.expect(1);

      var object1 = {
        'a': [1, 2]
      };

      var object2 = {
        'a': [1, 2],
        'b': [1, 2]
      };

      object1.b = object1.a;

      assert.strictEqual(_.isEqual(object1, object2), true);
    });

    QUnit.test('should treat objects created by `Object.create(null)` like a plain object', function(assert) {
      assert.expect(2);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.constructor = null;

      var object2 = { 'a': 1 };
      assert.strictEqual(_.isEqual(new Foo, object2), false);

      if (create)  {
        var object1 = create(null);
        object1.a = 1;
        assert.strictEqual(_.isEqual(object1, object2), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for objects with custom `toString` methods', function(assert) {
      assert.expect(1);

      var primitive,
          object = { 'toString': function() { return primitive; } },
          values = [true, null, 1, 'a', undefined],
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value) {
        primitive = value;
        return _.isEqual(object, value);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should avoid common type coercions', function(assert) {
      assert.expect(9);

      assert.strictEqual(_.isEqual(true, Object(false)), false);
      assert.strictEqual(_.isEqual(Object(false), Object(0)), false);
      assert.strictEqual(_.isEqual(false, Object('')), false);
      assert.strictEqual(_.isEqual(Object(36), Object('36')), false);
      assert.strictEqual(_.isEqual(0, ''), false);
      assert.strictEqual(_.isEqual(1, true), false);
      assert.strictEqual(_.isEqual(1337756400000, new Date(2012, 4, 23)), false);
      assert.strictEqual(_.isEqual('36', 36), false);
      assert.strictEqual(_.isEqual(36, '36'), false);
    });

    QUnit.test('should compare `arguments` objects', function(assert) {
      assert.expect(2);

      var args1 = (function() { return arguments; }(1, 2, 3)),
          args2 = (function() { return arguments; }(1, 2, 3)),
          args3 = (function() { return arguments; }(1, 2));

      assert.strictEqual(_.isEqual(args1, args2), true);
      assert.strictEqual(_.isEqual(args1, args3), false);
    });

    QUnit.test('should treat `arguments` objects like `Object` objects', function(assert) {
      assert.expect(4);

      var args = (function() { return arguments; }(1, 2, 3)),
          object = { '0': 1, '1': 2, '2': 3 };

      function Foo() {}
      Foo.prototype = object;

      assert.strictEqual(_.isEqual(args, object), true);
      assert.strictEqual(_.isEqual(object, args), true);

      assert.strictEqual(_.isEqual(args, new Foo), false);
      assert.strictEqual(_.isEqual(new Foo, args), false);
    });

    QUnit.test('should compare array buffers', function(assert) {
      assert.expect(2);

      if (ArrayBuffer) {
        var buffer1 = new ArrayBuffer(4),
            buffer2 = new ArrayBuffer(8);

        assert.strictEqual(_.isEqual(buffer1, buffer2), false);

        buffer1 = new Int8Array([-1]).buffer;
        buffer2 = new Uint8Array([255]).buffer;

        assert.strictEqual(_.isEqual(buffer1, buffer2), true);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should compare array views', function(assert) {
      assert.expect(2);

      lodashStable.times(2, function(index) {
        var ns = index ? realm : root;

        var pairs = lodashStable.map(arrayViews, function(type, viewIndex) {
          var otherType = arrayViews[(viewIndex + 1) % arrayViews.length],
              CtorA = ns[type] || function(n) { this.n = n; },
              CtorB = ns[otherType] || function(n) { this.n = n; },
              bufferA = ns[type] ? new ns.ArrayBuffer(8) : 8,
              bufferB = ns[otherType] ? new ns.ArrayBuffer(8) : 8,
              bufferC = ns[otherType] ? new ns.ArrayBuffer(16) : 16;

          return [new CtorA(bufferA), new CtorA(bufferA), new CtorB(bufferB), new CtorB(bufferC)];
        });

        var expected = lodashStable.map(pairs, lodashStable.constant([true, false, false]));

        var actual = lodashStable.map(pairs, function(pair) {
          return [_.isEqual(pair[0], pair[1]), _.isEqual(pair[0], pair[2]), _.isEqual(pair[2], pair[3])];
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should compare date objects', function(assert) {
      assert.expect(4);

      var date = new Date(2012, 4, 23);

      assert.strictEqual(_.isEqual(date, new Date(2012, 4, 23)), true);
      assert.strictEqual(_.isEqual(new Date('a'), new Date('b')), true);

      assert.strictEqual(_.isEqual(date, new Date(2013, 3, 25)), false);
      assert.strictEqual(_.isEqual(date, { 'getTime': lodashStable.constant(+date) }), false);
    });

    QUnit.test('should compare error objects', function(assert) {
      assert.expect(1);

      var pairs = lodashStable.map([
        'Error',
        'EvalError',
        'RangeError',
        'ReferenceError',
        'SyntaxError',
        'TypeError',
        'URIError'
      ], function(type, index, errorTypes) {
        var otherType = errorTypes[++index % errorTypes.length],
            CtorA = root[type],
            CtorB = root[otherType];

        return [new CtorA('a'), new CtorA('a'), new CtorB('a'), new CtorB('b')];
      });

      var expected = lodashStable.map(pairs, lodashStable.constant([true, false, false]));

      var actual = lodashStable.map(pairs, function(pair) {
        return [_.isEqual(pair[0], pair[1]), _.isEqual(pair[0], pair[2]), _.isEqual(pair[2], pair[3])];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should compare functions', function(assert) {
      assert.expect(2);

      function a() { return 1 + 2; }
      function b() { return 1 + 2; }

      assert.strictEqual(_.isEqual(a, a), true);
      assert.strictEqual(_.isEqual(a, b), false);
    });

    QUnit.test('should compare maps', function(assert) {
      assert.expect(8);

      if (Map) {
        lodashStable.each([[map, new Map], [map, realm.map]], function(maps) {
          var map1 = maps[0],
              map2 = maps[1];

          map1.set('a', 1);
          map2.set('b', 2);
          assert.strictEqual(_.isEqual(map1, map2), false);

          map1.set('b', 2);
          map2.set('a', 1);
          assert.strictEqual(_.isEqual(map1, map2), true);

          map1['delete']('a');
          map1.set('a', 1);
          assert.strictEqual(_.isEqual(map1, map2), true);

          map2['delete']('a');
          assert.strictEqual(_.isEqual(map1, map2), false);

          map1.clear();
          map2.clear();
        });
      }
      else {
        skipAssert(assert, 8);
      }
    });

    QUnit.test('should compare maps with circular references', function(assert) {
      assert.expect(2);

      if (Map) {
        var map1 = new Map,
            map2 = new Map;

        map1.set('a', map1);
        map2.set('a', map2);
        assert.strictEqual(_.isEqual(map1, map2), true);

        map1.set('b', 1);
        map2.set('b', 2);
        assert.strictEqual(_.isEqual(map1, map2), false);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should compare promises by reference', function(assert) {
      assert.expect(4);

      if (promise) {
        lodashStable.each([[promise, Promise.resolve(1)], [promise, realm.promise]], function(promises) {
          var promise1 = promises[0],
              promise2 = promises[1];

          assert.strictEqual(_.isEqual(promise1, promise2), false);
          assert.strictEqual(_.isEqual(promise1, promise1), true);
        });
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should compare regexes', function(assert) {
      assert.expect(5);

      assert.strictEqual(_.isEqual(/x/gim, /x/gim), true);
      assert.strictEqual(_.isEqual(/x/gim, /x/mgi), true);
      assert.strictEqual(_.isEqual(/x/gi, /x/g), false);
      assert.strictEqual(_.isEqual(/x/, /y/), false);
      assert.strictEqual(_.isEqual(/x/g, { 'global': true, 'ignoreCase': false, 'multiline': false, 'source': 'x' }), false);
    });

    QUnit.test('should compare sets', function(assert) {
      assert.expect(8);

      if (Set) {
        lodashStable.each([[set, new Set], [set, realm.set]], function(sets) {
          var set1 = sets[0],
              set2 = sets[1];

          set1.add(1);
          set2.add(2);
          assert.strictEqual(_.isEqual(set1, set2), false);

          set1.add(2);
          set2.add(1);
          assert.strictEqual(_.isEqual(set1, set2), true);

          set1['delete'](1);
          set1.add(1);
          assert.strictEqual(_.isEqual(set1, set2), true);

          set2['delete'](1);
          assert.strictEqual(_.isEqual(set1, set2), false);

          set1.clear();
          set2.clear();
        });
      }
      else {
        skipAssert(assert, 8);
      }
    });

    QUnit.test('should compare sets with circular references', function(assert) {
      assert.expect(2);

      if (Set) {
        var set1 = new Set,
            set2 = new Set;

        set1.add(set1);
        set2.add(set2);
        assert.strictEqual(_.isEqual(set1, set2), true);

        set1.add(1);
        set2.add(2);
        assert.strictEqual(_.isEqual(set1, set2), false);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should work as an iteratee for `_.every`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.every([1, 1, 1], lodashStable.partial(_.isEqual, 1));
      assert.ok(actual);
    });

    QUnit.test('should return `true` for like-objects from different documents', function(assert) {
      assert.expect(4);

      if (realm.object) {
        assert.strictEqual(_.isEqual([1], realm.array), true);
        assert.strictEqual(_.isEqual([2], realm.array), false);
        assert.strictEqual(_.isEqual({ 'a': 1 }, realm.object), true);
        assert.strictEqual(_.isEqual({ 'a': 2 }, realm.object), false);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should not error on DOM elements', function(assert) {
      assert.expect(1);

      if (document) {
        var element1 = document.createElement('div'),
            element2 = element1.cloneNode(true);

        try {
          assert.strictEqual(_.isEqual(element1, element2), false);
        } catch (e) {
          assert.ok(false, e.message);
        }
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should compare wrapped values', function(assert) {
      assert.expect(32);

      var stamp = +new Date;

      var values = [
        [[1, 2], [1, 2], [1, 2, 3]],
        [true, true, false],
        [new Date(stamp), new Date(stamp), new Date(stamp - 100)],
        [{ 'a': 1, 'b': 2 }, { 'a': 1, 'b': 2 }, { 'a': 1, 'b': 1 }],
        [1, 1, 2],
        [NaN, NaN, Infinity],
        [/x/, /x/, /x/i],
        ['a', 'a', 'A']
      ];

      lodashStable.each(values, function(vals) {
        if (!isNpm) {
          var wrapped1 = _(vals[0]),
              wrapped2 = _(vals[1]),
              actual = wrapped1.isEqual(wrapped2);

          assert.strictEqual(actual, true);
          assert.strictEqual(_.isEqual(_(actual), _(true)), true);

          wrapped1 = _(vals[0]);
          wrapped2 = _(vals[2]);

          actual = wrapped1.isEqual(wrapped2);
          assert.strictEqual(actual, false);
          assert.strictEqual(_.isEqual(_(actual), _(false)), true);
        }
        else {
          skipAssert(assert, 4);
        }
      });
    });

    QUnit.test('should compare wrapped and non-wrapped values', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var object1 = _({ 'a': 1, 'b': 2 }),
            object2 = { 'a': 1, 'b': 2 };

        assert.strictEqual(object1.isEqual(object2), true);
        assert.strictEqual(_.isEqual(object1, object2), true);

        object1 = _({ 'a': 1, 'b': 2 });
        object2 = { 'a': 1, 'b': 1 };

        assert.strictEqual(object1.isEqual(object2), false);
        assert.strictEqual(_.isEqual(object1, object2), false);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.strictEqual(_('a').isEqual('a'), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_('a').chain().isEqual('a') instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isEqualWith');

  (function() {
    QUnit.test('should provide correct `customizer` arguments', function(assert) {
      assert.expect(1);

      var argsList = [],
          object1 = { 'a': [1, 2], 'b': null },
          object2 = { 'a': [1, 2], 'b': null };

      object1.b = object2;
      object2.b = object1;

      var expected = [
        [object1, object2],
        [object1.a, object2.a, 'a', object1, object2],
        [object1.a[0], object2.a[0], 0, object1.a, object2.a],
        [object1.a[1], object2.a[1], 1, object1.a, object2.a],
        [object1.b, object2.b, 'b', object1.b, object2.b]
      ];

      _.isEqualWith(object1, object2, function(assert) {
        var length = arguments.length,
            args = slice.call(arguments, 0, length - (length > 2 ? 1 : 0));

        argsList.push(args);
      });

      assert.deepEqual(argsList, expected);
    });

    QUnit.test('should handle comparisons when `customizer` returns `undefined`', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.isEqualWith('a', 'a', noop), true);
      assert.strictEqual(_.isEqualWith(['a'], ['a'], noop), true);
      assert.strictEqual(_.isEqualWith({ '0': 'a' }, { '0': 'a' }, noop), true);
    });

    QUnit.test('should not handle comparisons when `customizer` returns `true`', function(assert) {
      assert.expect(3);

      var customizer = function(value) {
        return _.isString(value) || undefined;
      };

      assert.strictEqual(_.isEqualWith('a', 'b', customizer), true);
      assert.strictEqual(_.isEqualWith(['a'], ['b'], customizer), true);
      assert.strictEqual(_.isEqualWith({ '0': 'a' }, { '0': 'b' }, customizer), true);
    });

    QUnit.test('should not handle comparisons when `customizer` returns `false`', function(assert) {
      assert.expect(3);

      var customizer = function(value) {
        return _.isString(value) ? false : undefined;
      };

      assert.strictEqual(_.isEqualWith('a', 'a', customizer), false);
      assert.strictEqual(_.isEqualWith(['a'], ['a'], customizer), false);
      assert.strictEqual(_.isEqualWith({ '0': 'a' }, { '0': 'a' }, customizer), false);
    });

    QUnit.test('should return a boolean value even when `customizer` does not', function(assert) {
      assert.expect(2);

      var actual = _.isEqualWith('a', 'b', stubC);
      assert.strictEqual(actual, true);

      var values = _.without(falsey, undefined),
          expected = lodashStable.map(values, stubFalse);

      actual = [];
      lodashStable.each(values, function(value) {
        actual.push(_.isEqualWith('a', 'a', lodashStable.constant(value)));
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should ensure `customizer` is a function', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3],
          eq = _.partial(_.isEqualWith, array),
          actual = lodashStable.map([array, [1, 0, 3]], eq);

      assert.deepEqual(actual, [true, false]);
    });

    QUnit.test('should call `customizer` for values maps and sets', function(assert) {
      assert.expect(2);

      var value = { 'a': { 'b': 2 } };

      if (Map) {
        var map1 = new Map;
        map1.set('a', value);

        var map2 = new Map;
        map2.set('a', value);
      }
      if (Set) {
        var set1 = new Set;
        set1.add(value);

        var set2 = new Set;
        set2.add(value);
      }
      lodashStable.each([[map1, map2], [set1, set2]], function(pair, index) {
        if (pair[0]) {
          var argsList = [],
              array = lodashStable.toArray(pair[0]);

          var expected = [
            [pair[0], pair[1]],
            [array[0], array[0], 0, array, array],
            [array[0][0], array[0][0], 0, array[0], array[0]],
            [array[0][1], array[0][1], 1, array[0], array[0]]
          ];

          if (index) {
            expected.length = 2;
          }
          _.isEqualWith(pair[0], pair[1], function() {
            var length = arguments.length,
                args = slice.call(arguments, 0, length - (length > 2 ? 1 : 0));

            argsList.push(args);
          });

          assert.deepEqual(argsList, expected, index ? 'Set' : 'Map');
        }
        else {
          skipAssert(assert);
        }
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isError');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for error objects', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(errors, stubTrue);

      var actual = lodashStable.map(errors, function(error) {
        return _.isError(error) === true;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `true` for subclassed values', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isError(new CustomError('x')), true);
    });

    QUnit.test('should return `false` for non error objects', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isError(value) : _.isError();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isError(args), false);
      assert.strictEqual(_.isError([1, 2, 3]), false);
      assert.strictEqual(_.isError(true), false);
      assert.strictEqual(_.isError(new Date), false);
      assert.strictEqual(_.isError(_), false);
      assert.strictEqual(_.isError(slice), false);
      assert.strictEqual(_.isError({ 'a': 1 }), false);
      assert.strictEqual(_.isError(1), false);
      assert.strictEqual(_.isError(/x/), false);
      assert.strictEqual(_.isError('a'), false);
      assert.strictEqual(_.isError(symbol), false);
    });

    QUnit.test('should work with an error object from another realm', function(assert) {
      assert.expect(1);

      if (realm.errors) {
        var expected = lodashStable.map(realm.errors, stubTrue);

        var actual = lodashStable.map(realm.errors, function(error) {
          return _.isError(error) === true;
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isFinite');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for finite values', function(assert) {
      assert.expect(1);

      var values = [0, 1, 3.14, -1],
          expected = lodashStable.map(values, stubTrue),
          actual = lodashStable.map(values, _.isFinite);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non-finite values', function(assert) {
      assert.expect(1);

      var values = [NaN, Infinity, -Infinity, Object(1)],
          expected = lodashStable.map(values, stubFalse),
          actual = lodashStable.map(values, _.isFinite);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non-numeric values', function(assert) {
      assert.expect(10);

      var values = [undefined, [], true, '', ' ', '2px'],
          expected = lodashStable.map(values, stubFalse),
          actual = lodashStable.map(values, _.isFinite);

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isFinite(args), false);
      assert.strictEqual(_.isFinite([1, 2, 3]), false);
      assert.strictEqual(_.isFinite(true), false);
      assert.strictEqual(_.isFinite(new Date), false);
      assert.strictEqual(_.isFinite(new Error), false);
      assert.strictEqual(_.isFinite({ 'a': 1 }), false);
      assert.strictEqual(_.isFinite(/x/), false);
      assert.strictEqual(_.isFinite('a'), false);
      assert.strictEqual(_.isFinite(symbol), false);
    });

    QUnit.test('should return `false` for numeric string values', function(assert) {
      assert.expect(1);

      var values = ['2', '0', '08'],
          expected = lodashStable.map(values, stubFalse),
          actual = lodashStable.map(values, _.isFinite);

      assert.deepEqual(actual, expected);
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isFunction');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for functions', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.isFunction(_), true);
      assert.strictEqual(_.isFunction(slice), true);
    });

    QUnit.test('should return `true` for generator functions', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isFunction(generator), typeof generator == 'function');
    });

    QUnit.test('should return `true` for array view constructors', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(arrayViews, function(type) {
        return objToString.call(root[type]) == funcTag;
      });

      var actual = lodashStable.map(arrayViews, function(type) {
        return _.isFunction(root[type]);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non-functions', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isFunction(value) : _.isFunction();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isFunction(args), false);
      assert.strictEqual(_.isFunction([1, 2, 3]), false);
      assert.strictEqual(_.isFunction(true), false);
      assert.strictEqual(_.isFunction(new Date), false);
      assert.strictEqual(_.isFunction(new Error), false);
      assert.strictEqual(_.isFunction({ 'a': 1 }), false);
      assert.strictEqual(_.isFunction(1), false);
      assert.strictEqual(_.isFunction(/x/), false);
      assert.strictEqual(_.isFunction('a'), false);
      assert.strictEqual(_.isFunction(symbol), false);

      if (document) {
        assert.strictEqual(_.isFunction(document.getElementsByTagName('body')), false);
      } else {
        skipAssert(assert);
      }
    });

    QUnit.test('should work with host objects in IE 8 document mode (test in IE 11)', function(assert) {
      assert.expect(2);

      // Trigger a Chakra JIT bug.
      // See https://github.com/jashkenas/underscore/issues/1621.
      lodashStable.each([body, xml], function(object) {
        if (object) {
          lodashStable.times(100, _.isFunction);
          assert.strictEqual(_.isFunction(object), false);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    QUnit.test('should work with a function from another realm', function(assert) {
      assert.expect(1);

      if (realm.function) {
        assert.strictEqual(_.isFunction(realm.function), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('isInteger methods');

  lodashStable.each(['isInteger', 'isSafeInteger'], function(methodName) {
    var args = arguments,
        func = _[methodName],
        isSafe = methodName == 'isSafeInteger';

    QUnit.test('`_.' + methodName + '` should return `true` for integer values', function(assert) {
      assert.expect(2);

      var values = [-1, 0, 1],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        return func(value);
      });

      assert.deepEqual(actual, expected);
      assert.strictEqual(func(MAX_INTEGER), !isSafe);
    });

    QUnit.test('should return `false` for non-integer number values', function(assert) {
      assert.expect(1);

      var values = [NaN, Infinity, -Infinity, Object(1), 3.14],
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value) {
        return func(value);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non-numeric values', function(assert) {
      assert.expect(10);

      var expected = lodashStable.map(falsey, function(value) {
        return value === 0;
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? func(value) : func();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(func(args), false);
      assert.strictEqual(func([1, 2, 3]), false);
      assert.strictEqual(func(true), false);
      assert.strictEqual(func(new Date), false);
      assert.strictEqual(func(new Error), false);
      assert.strictEqual(func({ 'a': 1 }), false);
      assert.strictEqual(func(/x/), false);
      assert.strictEqual(func('a'), false);
      assert.strictEqual(func(symbol), false);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isLength');

  (function() {
    QUnit.test('should return `true` for lengths', function(assert) {
      assert.expect(1);

      var values = [0, 3, MAX_SAFE_INTEGER],
          expected = lodashStable.map(values, stubTrue),
          actual = lodashStable.map(values, _.isLength);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non-lengths', function(assert) {
      assert.expect(1);

      var values = [-1, '1', 1.1, MAX_SAFE_INTEGER + 1],
          expected = lodashStable.map(values, stubFalse),
          actual = lodashStable.map(values, _.isLength);

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isMap');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for maps', function(assert) {
      assert.expect(1);

      if (Map) {
        assert.strictEqual(_.isMap(map), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non-maps', function(assert) {
      assert.expect(14);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isMap(value) : _.isMap();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isMap(args), false);
      assert.strictEqual(_.isMap([1, 2, 3]), false);
      assert.strictEqual(_.isMap(true), false);
      assert.strictEqual(_.isMap(new Date), false);
      assert.strictEqual(_.isMap(new Error), false);
      assert.strictEqual(_.isMap(_), false);
      assert.strictEqual(_.isMap(slice), false);
      assert.strictEqual(_.isMap({ 'a': 1 }), false);
      assert.strictEqual(_.isMap(1), false);
      assert.strictEqual(_.isMap(/x/), false);
      assert.strictEqual(_.isMap('a'), false);
      assert.strictEqual(_.isMap(symbol), false);
      assert.strictEqual(_.isMap(weakMap), false);
    });

    QUnit.test('should work for objects with a non-function `constructor` (test in IE 11)', function(assert) {
      assert.expect(1);

      var values = [false, true],
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value) {
        return _.isMap({ 'constructor': value });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with maps from another realm', function(assert) {
      assert.expect(1);

      if (realm.map) {
        assert.strictEqual(_.isMap(realm.map), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isMatchWith');

  (function() {
    QUnit.test('should provide correct `customizer` arguments', function(assert) {
      assert.expect(1);

      var argsList = [],
          object1 = { 'a': [1, 2], 'b': null },
          object2 = { 'a': [1, 2], 'b': null };

      object1.b = object2;
      object2.b = object1;

      var expected = [
        [object1.a, object2.a, 'a', object1, object2],
        [object1.a[0], object2.a[0], 0, object1.a, object2.a],
        [object1.a[1], object2.a[1], 1, object1.a, object2.a],
        [object1.b, object2.b, 'b', object1, object2],
        [object1.b.a, object2.b.a, 'a', object1.b, object2.b],
        [object1.b.a[0], object2.b.a[0], 0, object1.b.a, object2.b.a],
        [object1.b.a[1], object2.b.a[1], 1, object1.b.a, object2.b.a],
        [object1.b.b, object2.b.b, 'b', object1.b, object2.b]
      ];

      _.isMatchWith(object1, object2, function(assert) {
        argsList.push(slice.call(arguments, 0, -1));
      });

      assert.deepEqual(argsList, expected);
    });

    QUnit.test('should handle comparisons when `customizer` returns `undefined`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isMatchWith({ 'a': 1 }, { 'a': 1 }, noop), true);
    });

    QUnit.test('should not handle comparisons when `customizer` returns `true`', function(assert) {
      assert.expect(2);

      var customizer = function(value) {
        return _.isString(value) || undefined;
      };

      assert.strictEqual(_.isMatchWith(['a'], ['b'], customizer), true);
      assert.strictEqual(_.isMatchWith({ '0': 'a' }, { '0': 'b' }, customizer), true);
    });

    QUnit.test('should not handle comparisons when `customizer` returns `false`', function(assert) {
      assert.expect(2);

      var customizer = function(value) {
        return _.isString(value) ? false : undefined;
      };

      assert.strictEqual(_.isMatchWith(['a'], ['a'], customizer), false);
      assert.strictEqual(_.isMatchWith({ '0': 'a' }, { '0': 'a' }, customizer), false);
    });

    QUnit.test('should return a boolean value even when `customizer` does not', function(assert) {
      assert.expect(2);

      var object = { 'a': 1 },
          actual = _.isMatchWith(object, { 'a': 1 }, stubA);

      assert.strictEqual(actual, true);

      var expected = lodashStable.map(falsey, stubFalse);

      actual = [];
      lodashStable.each(falsey, function(value) {
        actual.push(_.isMatchWith(object, { 'a': 2 }, lodashStable.constant(value)));
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should provide `stack` to `customizer`', function(assert) {
      assert.expect(1);

      var actual;

      _.isMatchWith({ 'a': 1 }, { 'a': 1 }, function() {
        actual = _.last(arguments);
      });

      assert.ok(isNpm
        ? actual.constructor.name == 'Stack'
        : actual instanceof mapCaches.Stack
      );
    });

    QUnit.test('should ensure `customizer` is a function', function(assert) {
      assert.expect(1);

      var object = { 'a': 1 },
          matches = _.partial(_.isMatchWith, object),
          actual = lodashStable.map([object, { 'a': 2 }], matches);

      assert.deepEqual(actual, [true, false]);
    });

    QUnit.test('should call `customizer` for values maps and sets', function(assert) {
      assert.expect(2);

      var value = { 'a': { 'b': 2 } };

      if (Map) {
        var map1 = new Map;
        map1.set('a', value);

        var map2 = new Map;
        map2.set('a', value);
      }
      if (Set) {
        var set1 = new Set;
        set1.add(value);

        var set2 = new Set;
        set2.add(value);
      }
      lodashStable.each([[map1, map2], [set1, set2]], function(pair, index) {
        if (pair[0]) {
          var argsList = [],
              array = lodashStable.toArray(pair[0]),
              object1 = { 'a': pair[0] },
              object2 = { 'a': pair[1] };

          var expected = [
            [pair[0], pair[1], 'a', object1, object2],
            [array[0], array[0], 0, array, array],
            [array[0][0], array[0][0], 0, array[0], array[0]],
            [array[0][1], array[0][1], 1, array[0], array[0]]
          ];

          if (index) {
            expected.length = 2;
          }
          _.isMatchWith({ 'a': pair[0] }, { 'a': pair[1] }, function() {
            argsList.push(slice.call(arguments, 0, -1));
          });

          assert.deepEqual(argsList, expected, index ? 'Set' : 'Map');
        }
        else {
          skipAssert(assert);
        }
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isNaN');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for NaNs', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.isNaN(NaN), true);
      assert.strictEqual(_.isNaN(Object(NaN)), true);
    });

    QUnit.test('should return `false` for non-NaNs', function(assert) {
      assert.expect(14);

      var expected = lodashStable.map(falsey, function(value) {
        return value !== value;
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isNaN(value) : _.isNaN();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isNaN(args), false);
      assert.strictEqual(_.isNaN([1, 2, 3]), false);
      assert.strictEqual(_.isNaN(true), false);
      assert.strictEqual(_.isNaN(new Date), false);
      assert.strictEqual(_.isNaN(new Error), false);
      assert.strictEqual(_.isNaN(_), false);
      assert.strictEqual(_.isNaN(slice), false);
      assert.strictEqual(_.isNaN({ 'a': 1 }), false);
      assert.strictEqual(_.isNaN(1), false);
      assert.strictEqual(_.isNaN(Object(1)), false);
      assert.strictEqual(_.isNaN(/x/), false);
      assert.strictEqual(_.isNaN('a'), false);
      assert.strictEqual(_.isNaN(symbol), false);
    });

    QUnit.test('should work with `NaN` from another realm', function(assert) {
      assert.expect(1);

      if (realm.object) {
        assert.strictEqual(_.isNaN(realm.nan), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isNative');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for native methods', function(assert) {
      assert.expect(1);

      var values = [Array, body && body.cloneNode, create, root.encodeURI, Promise, slice, Uint8Array],
          expected = lodashStable.map(values, Boolean),
          actual = lodashStable.map(values, _.isNative);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non-native methods', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isNative(value) : _.isNative();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isNative(args), false);
      assert.strictEqual(_.isNative([1, 2, 3]), false);
      assert.strictEqual(_.isNative(true), false);
      assert.strictEqual(_.isNative(new Date), false);
      assert.strictEqual(_.isNative(new Error), false);
      assert.strictEqual(_.isNative(_), false);
      assert.strictEqual(_.isNative({ 'a': 1 }), false);
      assert.strictEqual(_.isNative(1), false);
      assert.strictEqual(_.isNative(/x/), false);
      assert.strictEqual(_.isNative('a'), false);
      assert.strictEqual(_.isNative(symbol), false);
    });

    QUnit.test('should work with native functions from another realm', function(assert) {
      assert.expect(2);

      if (realm.element) {
        assert.strictEqual(_.isNative(realm.element.cloneNode), true);
      }
      else {
        skipAssert(assert);
      }
      if (realm.object) {
        assert.strictEqual(_.isNative(realm.object.valueOf), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should throw an error if core-js is detected', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var lodash = _.runInContext({
          '__core-js_shared__': {}
        });

        assert.raises(function() { lodash.isNative(noop); });
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should detect methods masquerading as native', function(assert) {
      assert.expect(2);

      if (!amd && _._baseEach) {
        var path = require('path'),
            basePath = path.dirname(filePath),
            uid = 'e0gvgyrad1jor',
            coreKey = '__core-js_shared__',
            fakeSrcKey = 'Symbol(src)_1.' + uid;

        root[coreKey] = { 'keys': { 'IE_PROTO': 'Symbol(IE_PROTO)_3.' + uid } };
        emptyObject(require.cache);

        var baseIsNative = interopRequire(path.join(basePath, '_baseIsNative'));
        assert.strictEqual(baseIsNative(slice), true);

        slice[fakeSrcKey] = slice + '';
        assert.strictEqual(baseIsNative(slice), false);

        delete slice[fakeSrcKey];
        delete root[coreKey];
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isNil');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for nullish values', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.isNil(null), true);
      assert.strictEqual(_.isNil(), true);
      assert.strictEqual(_.isNil(undefined), true);
    });

    QUnit.test('should return `false` for non-nullish values', function(assert) {
      assert.expect(13);

      var expected = lodashStable.map(falsey, function(value) {
        return value == null;
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isNil(value) : _.isNil();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isNil(args), false);
      assert.strictEqual(_.isNil([1, 2, 3]), false);
      assert.strictEqual(_.isNil(true), false);
      assert.strictEqual(_.isNil(new Date), false);
      assert.strictEqual(_.isNil(new Error), false);
      assert.strictEqual(_.isNil(_), false);
      assert.strictEqual(_.isNil(slice), false);
      assert.strictEqual(_.isNil({ 'a': 1 }), false);
      assert.strictEqual(_.isNil(1), false);
      assert.strictEqual(_.isNil(/x/), false);
      assert.strictEqual(_.isNil('a'), false);

      if (Symbol) {
        assert.strictEqual(_.isNil(symbol), false);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should work with nils from another realm', function(assert) {
      assert.expect(2);

      if (realm.object) {
        assert.strictEqual(_.isNil(realm.null), true);
        assert.strictEqual(_.isNil(realm.undefined), true);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isNull');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for `null` values', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isNull(null), true);
    });

    QUnit.test('should return `false` for non `null` values', function(assert) {
      assert.expect(13);

      var expected = lodashStable.map(falsey, function(value) {
        return value === null;
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isNull(value) : _.isNull();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isNull(args), false);
      assert.strictEqual(_.isNull([1, 2, 3]), false);
      assert.strictEqual(_.isNull(true), false);
      assert.strictEqual(_.isNull(new Date), false);
      assert.strictEqual(_.isNull(new Error), false);
      assert.strictEqual(_.isNull(_), false);
      assert.strictEqual(_.isNull(slice), false);
      assert.strictEqual(_.isNull({ 'a': 1 }), false);
      assert.strictEqual(_.isNull(1), false);
      assert.strictEqual(_.isNull(/x/), false);
      assert.strictEqual(_.isNull('a'), false);
      assert.strictEqual(_.isNull(symbol), false);
    });

    QUnit.test('should work with nulls from another realm', function(assert) {
      assert.expect(1);

      if (realm.object) {
        assert.strictEqual(_.isNull(realm.null), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isNumber');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for numbers', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.isNumber(0), true);
      assert.strictEqual(_.isNumber(Object(0)), true);
      assert.strictEqual(_.isNumber(NaN), true);
    });

    QUnit.test('should return `false` for non-numbers', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, function(value) {
        return typeof value == 'number';
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isNumber(value) : _.isNumber();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isNumber(args), false);
      assert.strictEqual(_.isNumber([1, 2, 3]), false);
      assert.strictEqual(_.isNumber(true), false);
      assert.strictEqual(_.isNumber(new Date), false);
      assert.strictEqual(_.isNumber(new Error), false);
      assert.strictEqual(_.isNumber(_), false);
      assert.strictEqual(_.isNumber(slice), false);
      assert.strictEqual(_.isNumber({ 'a': 1 }), false);
      assert.strictEqual(_.isNumber(/x/), false);
      assert.strictEqual(_.isNumber('a'), false);
      assert.strictEqual(_.isNumber(symbol), false);
    });

    QUnit.test('should work with numbers from another realm', function(assert) {
      assert.expect(1);

      if (realm.number) {
        assert.strictEqual(_.isNumber(realm.number), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should avoid `[xpconnect wrapped native prototype]` in Firefox', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.isNumber(+'2'), true);
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isObject');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for objects', function(assert) {
      assert.expect(13);

      assert.strictEqual(_.isObject(args), true);
      assert.strictEqual(_.isObject([1, 2, 3]), true);
      assert.strictEqual(_.isObject(Object(false)), true);
      assert.strictEqual(_.isObject(new Date), true);
      assert.strictEqual(_.isObject(new Error), true);
      assert.strictEqual(_.isObject(_), true);
      assert.strictEqual(_.isObject(slice), true);
      assert.strictEqual(_.isObject({ 'a': 1 }), true);
      assert.strictEqual(_.isObject(Object(0)), true);
      assert.strictEqual(_.isObject(/x/), true);
      assert.strictEqual(_.isObject(Object('a')), true);

      if (document) {
        assert.strictEqual(_.isObject(body), true);
      }
      else {
        skipAssert(assert);
      }
      if (Symbol) {
        assert.strictEqual(_.isObject(Object(symbol)), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non-objects', function(assert) {
      assert.expect(1);

      var values = falsey.concat(true, 1, 'a', symbol),
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.isObject(value) : _.isObject();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with objects from another realm', function(assert) {
      assert.expect(8);

      if (realm.element) {
        assert.strictEqual(_.isObject(realm.element), true);
      }
      else {
        skipAssert(assert);
      }
      if (realm.object) {
        assert.strictEqual(_.isObject(realm.boolean), true);
        assert.strictEqual(_.isObject(realm.date), true);
        assert.strictEqual(_.isObject(realm.function), true);
        assert.strictEqual(_.isObject(realm.number), true);
        assert.strictEqual(_.isObject(realm.object), true);
        assert.strictEqual(_.isObject(realm.regexp), true);
        assert.strictEqual(_.isObject(realm.string), true);
      }
      else {
        skipAssert(assert, 7);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isObjectLike');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for objects', function(assert) {
      assert.expect(9);

      assert.strictEqual(_.isObjectLike(args), true);
      assert.strictEqual(_.isObjectLike([1, 2, 3]), true);
      assert.strictEqual(_.isObjectLike(Object(false)), true);
      assert.strictEqual(_.isObjectLike(new Date), true);
      assert.strictEqual(_.isObjectLike(new Error), true);
      assert.strictEqual(_.isObjectLike({ 'a': 1 }), true);
      assert.strictEqual(_.isObjectLike(Object(0)), true);
      assert.strictEqual(_.isObjectLike(/x/), true);
      assert.strictEqual(_.isObjectLike(Object('a')), true);
    });

    QUnit.test('should return `false` for non-objects', function(assert) {
      assert.expect(1);

      var values = falsey.concat(true, _, slice, 1, 'a', symbol),
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.isObjectLike(value) : _.isObjectLike();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with objects from another realm', function(assert) {
      assert.expect(6);

      if (realm.object) {
        assert.strictEqual(_.isObjectLike(realm.boolean), true);
        assert.strictEqual(_.isObjectLike(realm.date), true);
        assert.strictEqual(_.isObjectLike(realm.number), true);
        assert.strictEqual(_.isObjectLike(realm.object), true);
        assert.strictEqual(_.isObjectLike(realm.regexp), true);
        assert.strictEqual(_.isObjectLike(realm.string), true);
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isPlainObject');

  (function() {
    var element = document && document.createElement('div');

    QUnit.test('should detect plain objects', function(assert) {
      assert.expect(5);

      function Foo(a) {
        this.a = 1;
      }

      assert.strictEqual(_.isPlainObject({}), true);
      assert.strictEqual(_.isPlainObject({ 'a': 1 }), true);
      assert.strictEqual(_.isPlainObject({ 'constructor': Foo }), true);
      assert.strictEqual(_.isPlainObject([1, 2, 3]), false);
      assert.strictEqual(_.isPlainObject(new Foo(1)), false);
    });

    QUnit.test('should return `true` for objects with a `[[Prototype]]` of `null`', function(assert) {
      assert.expect(2);

      if (create) {
        var object = create(null);
        assert.strictEqual(_.isPlainObject(object), true);

        object.constructor = objectProto.constructor;
        assert.strictEqual(_.isPlainObject(object), true);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should return `true` for plain objects with a custom `valueOf` property', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.isPlainObject({ 'valueOf': 0 }), true);

      if (element) {
        var valueOf = element.valueOf;
        element.valueOf = 0;

        assert.strictEqual(_.isPlainObject(element), false);
        element.valueOf = valueOf;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for objects with a custom `[[Prototype]]`', function(assert) {
      assert.expect(1);

      if (create) {
        var object = create({ 'a': 1 });
        assert.strictEqual(_.isPlainObject(object), false);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for DOM elements', function(assert) {
      assert.expect(1);

      if (element) {
        assert.strictEqual(_.isPlainObject(element), false);
      } else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for Object objects without a `toStringTag` of "Object"', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.isPlainObject(arguments), false);
      assert.strictEqual(_.isPlainObject(Error), false);
      assert.strictEqual(_.isPlainObject(Math), false);
    });

    QUnit.test('should return `false` for non-objects', function(assert) {
      assert.expect(4);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isPlainObject(value) : _.isPlainObject();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isPlainObject(true), false);
      assert.strictEqual(_.isPlainObject('a'), false);
      assert.strictEqual(_.isPlainObject(symbol), false);
    });

    QUnit.test('should work with objects from another realm', function(assert) {
      assert.expect(1);

      if (realm.object) {
        assert.strictEqual(_.isPlainObject(realm.object), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isRegExp');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for regexes', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.isRegExp(/x/), true);
      assert.strictEqual(_.isRegExp(RegExp('x')), true);
    });

    QUnit.test('should return `false` for non-regexes', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isRegExp(value) : _.isRegExp();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isRegExp(args), false);
      assert.strictEqual(_.isRegExp([1, 2, 3]), false);
      assert.strictEqual(_.isRegExp(true), false);
      assert.strictEqual(_.isRegExp(new Date), false);
      assert.strictEqual(_.isRegExp(new Error), false);
      assert.strictEqual(_.isRegExp(_), false);
      assert.strictEqual(_.isRegExp(slice), false);
      assert.strictEqual(_.isRegExp({ 'a': 1 }), false);
      assert.strictEqual(_.isRegExp(1), false);
      assert.strictEqual(_.isRegExp('a'), false);
      assert.strictEqual(_.isRegExp(symbol), false);
    });

    QUnit.test('should work with regexes from another realm', function(assert) {
      assert.expect(1);

      if (realm.regexp) {
        assert.strictEqual(_.isRegExp(realm.regexp), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isSet');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for sets', function(assert) {
      assert.expect(1);

      if (Set) {
        assert.strictEqual(_.isSet(set), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non-sets', function(assert) {
      assert.expect(14);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isSet(value) : _.isSet();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isSet(args), false);
      assert.strictEqual(_.isSet([1, 2, 3]), false);
      assert.strictEqual(_.isSet(true), false);
      assert.strictEqual(_.isSet(new Date), false);
      assert.strictEqual(_.isSet(new Error), false);
      assert.strictEqual(_.isSet(_), false);
      assert.strictEqual(_.isSet(slice), false);
      assert.strictEqual(_.isSet({ 'a': 1 }), false);
      assert.strictEqual(_.isSet(1), false);
      assert.strictEqual(_.isSet(/x/), false);
      assert.strictEqual(_.isSet('a'), false);
      assert.strictEqual(_.isSet(symbol), false);
      assert.strictEqual(_.isSet(weakSet), false);
    });

    QUnit.test('should work for objects with a non-function `constructor` (test in IE 11)', function(assert) {
      assert.expect(1);

      var values = [false, true],
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value) {
        return _.isSet({ 'constructor': value });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with weak sets from another realm', function(assert) {
      assert.expect(1);

      if (realm.set) {
        assert.strictEqual(_.isSet(realm.set), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isString');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for strings', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.isString('a'), true);
      assert.strictEqual(_.isString(Object('a')), true);
    });

    QUnit.test('should return `false` for non-strings', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, function(value) {
        return value === '';
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isString(value) : _.isString();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isString(args), false);
      assert.strictEqual(_.isString([1, 2, 3]), false);
      assert.strictEqual(_.isString(true), false);
      assert.strictEqual(_.isString(new Date), false);
      assert.strictEqual(_.isString(new Error), false);
      assert.strictEqual(_.isString(_), false);
      assert.strictEqual(_.isString(slice), false);
      assert.strictEqual(_.isString({ '0': 1, 'length': 1 }), false);
      assert.strictEqual(_.isString(1), false);
      assert.strictEqual(_.isString(/x/), false);
      assert.strictEqual(_.isString(symbol), false);
    });

    QUnit.test('should work with strings from another realm', function(assert) {
      assert.expect(1);

      if (realm.string) {
        assert.strictEqual(_.isString(realm.string), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isSymbol');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for symbols', function(assert) {
      assert.expect(2);

      if (Symbol) {
        assert.strictEqual(_.isSymbol(symbol), true);
        assert.strictEqual(_.isSymbol(Object(symbol)), true);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should return `false` for non-symbols', function(assert) {
      assert.expect(12);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isSymbol(value) : _.isSymbol();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isSymbol(args), false);
      assert.strictEqual(_.isSymbol([1, 2, 3]), false);
      assert.strictEqual(_.isSymbol(true), false);
      assert.strictEqual(_.isSymbol(new Date), false);
      assert.strictEqual(_.isSymbol(new Error), false);
      assert.strictEqual(_.isSymbol(_), false);
      assert.strictEqual(_.isSymbol(slice), false);
      assert.strictEqual(_.isSymbol({ '0': 1, 'length': 1 }), false);
      assert.strictEqual(_.isSymbol(1), false);
      assert.strictEqual(_.isSymbol(/x/), false);
      assert.strictEqual(_.isSymbol('a'), false);
    });

    QUnit.test('should work with symbols from another realm', function(assert) {
      assert.expect(1);

      if (Symbol && realm.symbol) {
        assert.strictEqual(_.isSymbol(realm.symbol), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isTypedArray');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for typed arrays', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(typedArrays, function(type) {
        return type in root;
      });

      var actual = lodashStable.map(typedArrays, function(type) {
        var Ctor = root[type];
        return Ctor ? _.isTypedArray(new Ctor(new ArrayBuffer(8))) : false;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `false` for non typed arrays', function(assert) {
      assert.expect(13);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isTypedArray(value) : _.isTypedArray();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isTypedArray(args), false);
      assert.strictEqual(_.isTypedArray([1, 2, 3]), false);
      assert.strictEqual(_.isTypedArray(true), false);
      assert.strictEqual(_.isTypedArray(new Date), false);
      assert.strictEqual(_.isTypedArray(new Error), false);
      assert.strictEqual(_.isTypedArray(_), false);
      assert.strictEqual(_.isTypedArray(slice), false);
      assert.strictEqual(_.isTypedArray({ 'a': 1 }), false);
      assert.strictEqual(_.isTypedArray(1), false);
      assert.strictEqual(_.isTypedArray(/x/), false);
      assert.strictEqual(_.isTypedArray('a'), false);
      assert.strictEqual(_.isTypedArray(symbol), false);
    });

    QUnit.test('should work with typed arrays from another realm', function(assert) {
      assert.expect(1);

      if (realm.object) {
        var props = lodashStable.invokeMap(typedArrays, 'toLowerCase');

        var expected = lodashStable.map(props, function(key) {
          return realm[key] !== undefined;
        });

        var actual = lodashStable.map(props, function(key) {
          var value = realm[key];
          return value ? _.isTypedArray(value) : false;
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isUndefined');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for `undefined` values', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.isUndefined(), true);
      assert.strictEqual(_.isUndefined(undefined), true);
    });

    QUnit.test('should return `false` for non `undefined` values', function(assert) {
      assert.expect(13);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined;
      });

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isUndefined(value) : _.isUndefined();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isUndefined(args), false);
      assert.strictEqual(_.isUndefined([1, 2, 3]), false);
      assert.strictEqual(_.isUndefined(true), false);
      assert.strictEqual(_.isUndefined(new Date), false);
      assert.strictEqual(_.isUndefined(new Error), false);
      assert.strictEqual(_.isUndefined(_), false);
      assert.strictEqual(_.isUndefined(slice), false);
      assert.strictEqual(_.isUndefined({ 'a': 1 }), false);
      assert.strictEqual(_.isUndefined(1), false);
      assert.strictEqual(_.isUndefined(/x/), false);
      assert.strictEqual(_.isUndefined('a'), false);

      if (Symbol) {
        assert.strictEqual(_.isUndefined(symbol), false);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should work with `undefined` from another realm', function(assert) {
      assert.expect(1);

      if (realm.object) {
        assert.strictEqual(_.isUndefined(realm.undefined), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isWeakMap');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for weak maps', function(assert) {
      assert.expect(1);

      if (WeakMap) {
        assert.strictEqual(_.isWeakMap(weakMap), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non weak maps', function(assert) {
      assert.expect(14);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isWeakMap(value) : _.isWeakMap();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isWeakMap(args), false);
      assert.strictEqual(_.isWeakMap([1, 2, 3]), false);
      assert.strictEqual(_.isWeakMap(true), false);
      assert.strictEqual(_.isWeakMap(new Date), false);
      assert.strictEqual(_.isWeakMap(new Error), false);
      assert.strictEqual(_.isWeakMap(_), false);
      assert.strictEqual(_.isWeakMap(slice), false);
      assert.strictEqual(_.isWeakMap({ 'a': 1 }), false);
      assert.strictEqual(_.isWeakMap(map), false);
      assert.strictEqual(_.isWeakMap(1), false);
      assert.strictEqual(_.isWeakMap(/x/), false);
      assert.strictEqual(_.isWeakMap('a'), false);
      assert.strictEqual(_.isWeakMap(symbol), false);
    });

    QUnit.test('should work for objects with a non-function `constructor` (test in IE 11)', function(assert) {
      assert.expect(1);

      var values = [false, true],
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value) {
        return _.isWeakMap({ 'constructor': value });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with weak maps from another realm', function(assert) {
      assert.expect(1);

      if (realm.weakMap) {
        assert.strictEqual(_.isWeakMap(realm.weakMap), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.isWeakSet');

  (function() {
    var args = arguments;

    QUnit.test('should return `true` for weak sets', function(assert) {
      assert.expect(1);

      if (WeakSet) {
        assert.strictEqual(_.isWeakSet(weakSet), true);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return `false` for non weak sets', function(assert) {
      assert.expect(14);

      var expected = lodashStable.map(falsey, stubFalse);

      var actual = lodashStable.map(falsey, function(value, index) {
        return index ? _.isWeakSet(value) : _.isWeakSet();
      });

      assert.deepEqual(actual, expected);

      assert.strictEqual(_.isWeakSet(args), false);
      assert.strictEqual(_.isWeakSet([1, 2, 3]), false);
      assert.strictEqual(_.isWeakSet(true), false);
      assert.strictEqual(_.isWeakSet(new Date), false);
      assert.strictEqual(_.isWeakSet(new Error), false);
      assert.strictEqual(_.isWeakSet(_), false);
      assert.strictEqual(_.isWeakSet(slice), false);
      assert.strictEqual(_.isWeakSet({ 'a': 1 }), false);
      assert.strictEqual(_.isWeakSet(1), false);
      assert.strictEqual(_.isWeakSet(/x/), false);
      assert.strictEqual(_.isWeakSet('a'), false);
      assert.strictEqual(_.isWeakSet(set), false);
      assert.strictEqual(_.isWeakSet(symbol), false);
    });

    QUnit.test('should work with weak sets from another realm', function(assert) {
      assert.expect(1);

      if (realm.weakSet) {
        assert.strictEqual(_.isWeakSet(realm.weakSet), true);
      }
      else {
        skipAssert(assert);
      }
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('isType checks');

  (function() {
    QUnit.test('should return `false` for subclassed values', function(assert) {
      assert.expect(7);

      var funcs = [
        'isArray', 'isBoolean', 'isDate', 'isFunction',
        'isNumber', 'isRegExp', 'isString'
      ];

      lodashStable.each(funcs, function(methodName) {
        function Foo() {}
        Foo.prototype = root[methodName.slice(2)].prototype;

        var object = new Foo;
        if (objToString.call(object) == objectTag) {
          assert.strictEqual(_[methodName](object), false, '`_.' + methodName + '` returns `false`');
        }
        else {
          skipAssert(assert);
        }
      });
    });

    QUnit.test('should not error on host objects (test in IE)', function(assert) {
      assert.expect(26);

      var funcs = [
        'isArguments', 'isArray', 'isArrayBuffer', 'isArrayLike', 'isBoolean',
        'isBuffer', 'isDate', 'isElement', 'isError', 'isFinite', 'isFunction',
        'isInteger', 'isMap', 'isNaN', 'isNil', 'isNull', 'isNumber', 'isObject',
        'isObjectLike', 'isRegExp', 'isSet', 'isSafeInteger', 'isString',
        'isUndefined', 'isWeakMap', 'isWeakSet'
      ];

      lodashStable.each(funcs, function(methodName) {
        if (xml) {
          var pass = true;

          try {
            _[methodName](xml);
          } catch (e) {
            pass = false;
          }
          assert.ok(pass, '`_.' + methodName + '` should not error');
        }
        else {
          skipAssert(assert);
        }
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.iteratee');

  (function() {
    QUnit.test('should provide arguments to `func`', function(assert) {
      assert.expect(1);

      var fn = function() { return slice.call(arguments); },
          iteratee = _.iteratee(fn),
          actual = iteratee('a', 'b', 'c', 'd', 'e', 'f');

      assert.deepEqual(actual, ['a', 'b', 'c', 'd', 'e', 'f']);
    });

    QUnit.test('should return `_.identity` when `func` is nullish', function(assert) {
      assert.expect(1);

      var object = {},
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([!isNpm && _.identity, object]));

      var actual = lodashStable.map(values, function(value, index) {
        var identity = index ? _.iteratee(value) : _.iteratee();
        return [!isNpm && identity, identity(object)];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an iteratee created by `_.matches` when `func` is an object', function(assert) {
      assert.expect(2);

      var matches = _.iteratee({ 'a': 1, 'b': 2 });
      assert.strictEqual(matches({ 'a': 1, 'b': 2, 'c': 3 }), true);
      assert.strictEqual(matches({ 'b': 2 }), false);
    });

    QUnit.test('should not change `_.matches` behavior if `source` is modified', function(assert) {
      assert.expect(9);

      var sources = [
        { 'a': { 'b': 2, 'c': 3 } },
        { 'a': 1, 'b': 2 },
        { 'a': 1 }
      ];

      lodashStable.each(sources, function(source, index) {
        var object = lodashStable.cloneDeep(source),
            matches = _.iteratee(source);

        assert.strictEqual(matches(object), true);

        if (index) {
          source.a = 2;
          source.b = 1;
          source.c = 3;
        } else {
          source.a.b = 1;
          source.a.c = 2;
          source.a.d = 3;
        }
        assert.strictEqual(matches(object), true);
        assert.strictEqual(matches(source), false);
      });
    });

    QUnit.test('should return an iteratee created by `_.matchesProperty` when `func` is an array', function(assert) {
      assert.expect(3);

      var array = ['a', undefined],
          matches = _.iteratee([0, 'a']);

      assert.strictEqual(matches(array), true);

      matches = _.iteratee(['0', 'a']);
      assert.strictEqual(matches(array), true);

      matches = _.iteratee([1, undefined]);
      assert.strictEqual(matches(array), true);
    });

    QUnit.test('should support deep paths for `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      var object = { 'a': { 'b': { 'c': 1, 'd': 2 } } },
          matches = _.iteratee(['a.b', { 'c': 1 }]);

      assert.strictEqual(matches(object), true);
    });

    QUnit.test('should not change `_.matchesProperty` behavior if `source` is modified', function(assert) {
      assert.expect(9);

      var sources = [
        { 'a': { 'b': 2, 'c': 3 } },
        { 'a': 1, 'b': 2 },
        { 'a': 1 }
      ];

      lodashStable.each(sources, function(source, index) {
        var object = { 'a': lodashStable.cloneDeep(source) },
            matches = _.iteratee(['a', source]);

        assert.strictEqual(matches(object), true);

        if (index) {
          source.a = 2;
          source.b = 1;
          source.c = 3;
        } else {
          source.a.b = 1;
          source.a.c = 2;
          source.a.d = 3;
        }
        assert.strictEqual(matches(object), true);
        assert.strictEqual(matches({ 'a': source }), false);
      });
    });

    QUnit.test('should return an iteratee created by `_.property` when `func` is a number or string', function(assert) {
      assert.expect(2);

      var array = ['a'],
          prop = _.iteratee(0);

      assert.strictEqual(prop(array), 'a');

      prop = _.iteratee('0');
      assert.strictEqual(prop(array), 'a');
    });

    QUnit.test('should support deep paths for `_.property` shorthands', function(assert) {
      assert.expect(1);

      var object = { 'a': { 'b': 2 } },
          prop = _.iteratee('a.b');

      assert.strictEqual(prop(object), 2);
    });

    QUnit.test('should work with functions created by `_.partial` and `_.partialRight`', function(assert) {
      assert.expect(2);

      var fn = function() {
        var result = [this.a];
        push.apply(result, arguments);
        return result;
      };

      var expected = [1, 2, 3],
          object = { 'a': 1 , 'iteratee': _.iteratee(_.partial(fn, 2)) };

      assert.deepEqual(object.iteratee(3), expected);

      object.iteratee = _.iteratee(_.partialRight(fn, 3));
      assert.deepEqual(object.iteratee(2), expected);
    });

    QUnit.test('should use internal `iteratee` if external is unavailable', function(assert) {
      assert.expect(1);

      var iteratee = _.iteratee;
      delete _.iteratee;

      assert.deepEqual(_.map([{ 'a': 1 }], 'a'), [1]);

      _.iteratee = iteratee;
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var fn = function() { return this instanceof Number; },
          array = [fn, fn, fn],
          iteratees = lodashStable.map(array, _.iteratee),
          expected = lodashStable.map(array, stubFalse);

      var actual = lodashStable.map(iteratees, function(iteratee) {
        return iteratee();
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('custom `_.iteratee` methods');

  (function() {
    var array = ['one', 'two', 'three'],
        getPropA = _.partial(_.property, 'a'),
        getPropB = _.partial(_.property, 'b'),
        getLength = _.partial(_.property, 'length'),
        iteratee = _.iteratee;

    var getSum = function() {
      return function(result, object) {
        return result + object.a;
      };
    };

    var objects = [
      { 'a': 0, 'b': 0 },
      { 'a': 1, 'b': 0 },
      { 'a': 1, 'b': 1 }
    ];

    QUnit.test('`_.countBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getLength;
        assert.deepEqual(_.countBy(array), { '3': 2, '5': 1 });
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.differenceBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.deepEqual(_.differenceBy(objects, [objects[1]]), [objects[0]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.dropRightWhile` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.dropRightWhile(objects), objects.slice(0, 2));
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.dropWhile` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.dropWhile(objects.reverse()).reverse(), objects.reverse().slice(0, 2));
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.every` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.strictEqual(_.every(objects.slice(1)), true);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.filter` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var objects = [{ 'a': 0 }, { 'a': 1 }];

        _.iteratee = getPropA;
        assert.deepEqual(_.filter(objects), [objects[1]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.find` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.strictEqual(_.find(objects), objects[1]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.findIndex` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.strictEqual(_.findIndex(objects), 1);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.findLast` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.strictEqual(_.findLast(objects), objects[2]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.findLastIndex` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.strictEqual(_.findLastIndex(objects), 2);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.findKey` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.strictEqual(_.findKey(objects), '2');
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.findLastKey` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.strictEqual(_.findLastKey(objects), '2');
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.groupBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getLength;
        assert.deepEqual(_.groupBy(array), { '3': ['one', 'two'], '5': ['three'] });
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.intersectionBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.deepEqual(_.intersectionBy(objects, [objects[2]]), [objects[1]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.keyBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getLength;
        assert.deepEqual(_.keyBy(array), { '3': 'two', '5': 'three' });
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.map` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.deepEqual(_.map(objects), [0, 1, 1]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.mapKeys` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.mapKeys({ 'a': { 'b': 2 } }), { '2':  { 'b': 2 } });
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.mapValues` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.mapValues({ 'a': { 'b': 2 } }), { 'a': 2 });
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.maxBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.maxBy(objects), objects[2]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.meanBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.strictEqual(_.meanBy(objects), 2 / 3);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.minBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.minBy(objects), objects[0]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.partition` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var objects = [{ 'a': 1 }, { 'a': 1 }, { 'b': 2 }];

        _.iteratee = getPropA;
        assert.deepEqual(_.partition(objects), [objects.slice(0, 2), objects.slice(2)]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.pullAllBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.deepEqual(_.pullAllBy(objects.slice(), [{ 'a': 1, 'b': 0 }]), [objects[0]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.reduce` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getSum;
        assert.strictEqual(_.reduce(objects, undefined, 0), 2);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.reduceRight` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getSum;
        assert.strictEqual(_.reduceRight(objects, undefined, 0), 2);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.reject` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var objects = [{ 'a': 0 }, { 'a': 1 }];

        _.iteratee = getPropA;
        assert.deepEqual(_.reject(objects), [objects[0]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.remove` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var objects = [{ 'a': 0 }, { 'a': 1 }];

        _.iteratee = getPropA;
        _.remove(objects);
        assert.deepEqual(objects, [{ 'a': 0 }]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.some` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.strictEqual(_.some(objects), true);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.sortBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.deepEqual(_.sortBy(objects.slice().reverse()), [objects[0], objects[2], objects[1]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.sortedIndexBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var objects = [{ 'a': 30 }, { 'a': 50 }];

        _.iteratee = getPropA;
        assert.strictEqual(_.sortedIndexBy(objects, { 'a': 40 }), 1);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.sortedLastIndexBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var objects = [{ 'a': 30 }, { 'a': 50 }];

        _.iteratee = getPropA;
        assert.strictEqual(_.sortedLastIndexBy(objects, { 'a': 40 }), 1);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.sumBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.strictEqual(_.sumBy(objects), 1);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.takeRightWhile` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.takeRightWhile(objects), objects.slice(2));
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.takeWhile` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.takeWhile(objects.reverse()), objects.reverse().slice(2));
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.transform` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = function() {
          return function(result, object) {
            result.sum += object.a;
          };
        };

        assert.deepEqual(_.transform(objects, undefined, { 'sum': 0 }), { 'sum': 2 });
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.uniqBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.uniqBy(objects), [objects[0], objects[2]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.unionBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropB;
        assert.deepEqual(_.unionBy(objects.slice(0, 1), [objects[2]]), [objects[0], objects[2]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.xorBy` should use `_.iteratee` internally', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        _.iteratee = getPropA;
        assert.deepEqual(_.xorBy(objects, objects.slice(1)), [objects[0]]);
        _.iteratee = iteratee;
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.join');

  (function() {
    var array = ['a', 'b', 'c'];

    QUnit.test('should return join all array elements into a string', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.join(array, '~'), 'a~b~c');
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _(array);
        assert.strictEqual(wrapped.join('~'), 'a~b~c');
        assert.strictEqual(wrapped.value(), array);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(array).chain().join('~') instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.keyBy');

  (function() {
    var array = [
      { 'dir': 'left', 'code': 97 },
      { 'dir': 'right', 'code': 100 }
    ];

    QUnit.test('should transform keys by `iteratee`', function(assert) {
      assert.expect(1);

      var expected = { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } };

      var actual = _.keyBy(array, function(object) {
        return String.fromCharCode(object.code);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var array = [4, 6, 6],
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant({ '4': 4, '6': 6 }));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.keyBy(array, value) : _.keyBy(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var expected = { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } },
          actual = _.keyBy(array, 'dir');

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should only add values to own, not inherited, properties', function(assert) {
      assert.expect(2);

      var actual = _.keyBy([6.1, 4.2, 6.3], function(n) {
        return Math.floor(n) > 4 ? 'hasOwnProperty' : 'constructor';
      });

      assert.deepEqual(actual.constructor, 4.2);
      assert.deepEqual(actual.hasOwnProperty, 6.3);
    });

    QUnit.test('should work with a number for `iteratee`', function(assert) {
      assert.expect(2);

      var array = [
        [1, 'a'],
        [2, 'a'],
        [2, 'b']
      ];

      assert.deepEqual(_.keyBy(array, 0), { '1': [1, 'a'], '2': [2, 'b'] });
      assert.deepEqual(_.keyBy(array, 1), { 'a': [2, 'a'], 'b': [2, 'b'] });
    });

    QUnit.test('should work with an object for `collection`', function(assert) {
      assert.expect(1);

      var actual = _.keyBy({ 'a': 6.1, 'b': 4.2, 'c': 6.3 }, Math.floor);
      assert.deepEqual(actual, { '4': 4.2, '6': 6.3 });
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE).concat(
          lodashStable.range(Math.floor(LARGE_ARRAY_SIZE / 2), LARGE_ARRAY_SIZE),
          lodashStable.range(Math.floor(LARGE_ARRAY_SIZE / 1.5), LARGE_ARRAY_SIZE)
        );

        var actual = _(array).keyBy().map(square).filter(isEven).take().value();

        assert.deepEqual(actual, _.take(_.filter(_.map(_.keyBy(array), square), isEven)));
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('keys methods');

  lodashStable.each(['keys', 'keysIn'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        strictArgs = (function() { 'use strict'; return arguments; }(1, 2, 3)),
        func = _[methodName],
        isKeys = methodName == 'keys';

    QUnit.test('`_.' + methodName + '` should return the string keyed property names of `object`', function(assert) {
      assert.expect(1);

      var actual = func({ 'a': 1, 'b': 1 }).sort();

      assert.deepEqual(actual, ['a', 'b']);
    });

    QUnit.test('`_.' + methodName + '` should ' + (isKeys ? 'not ' : '') + 'include inherited string keyed properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var expected = isKeys ? ['a'] : ['a', 'b'],
          actual = func(new Foo).sort();

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should treat sparse arrays as dense', function(assert) {
      assert.expect(1);

      var array = [1];
      array[2] = 3;

      var actual = func(array).sort();

      assert.deepEqual(actual, ['0', '1', '2']);
    });

    QUnit.test('`_.' + methodName + '` should return keys for custom properties on arrays', function(assert) {
      assert.expect(1);

      var array = [1];
      array.a = 1;

      var actual = func(array).sort();

      assert.deepEqual(actual, ['0', 'a']);
    });

    QUnit.test('`_.' + methodName + '` should ' + (isKeys ? 'not ' : '') + 'include inherited string keyed properties of arrays', function(assert) {
      assert.expect(1);

      arrayProto.a = 1;

      var expected = isKeys ? ['0'] : ['0', 'a'],
          actual = func([1]).sort();

      assert.deepEqual(actual, expected);

      delete arrayProto.a;
    });

    QUnit.test('`_.' + methodName + '` should work with `arguments` objects', function(assert) {
      assert.expect(1);

      var values = [args, strictArgs],
          expected = lodashStable.map(values, lodashStable.constant(['0', '1', '2']));

      var actual = lodashStable.map(values, function(value) {
        return func(value).sort();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return keys for custom properties on `arguments` objects', function(assert) {
      assert.expect(1);

      var values = [args, strictArgs],
          expected = lodashStable.map(values, lodashStable.constant(['0', '1', '2', 'a']));

      var actual = lodashStable.map(values, function(value) {
        value.a = 1;
        var result = func(value).sort();
        delete value.a;
        return result;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should ' + (isKeys ? 'not ' : '') + 'include inherited string keyed properties of `arguments` objects', function(assert) {
      assert.expect(1);

      var values = [args, strictArgs],
          expected = lodashStable.map(values, lodashStable.constant(isKeys ? ['0', '1', '2'] : ['0', '1', '2', 'a']));

      var actual = lodashStable.map(values, function(value) {
        objectProto.a = 1;
        var result = func(value).sort();
        delete objectProto.a;
        return result;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with string objects', function(assert) {
      assert.expect(1);

      var actual = func(Object('abc')).sort();

      assert.deepEqual(actual, ['0', '1', '2']);
    });

    QUnit.test('`_.' + methodName + '` should return keys for custom properties on string objects', function(assert) {
      assert.expect(1);

      var object = Object('a');
      object.a = 1;

      var actual = func(object).sort();

      assert.deepEqual(actual, ['0', 'a']);
    });

    QUnit.test('`_.' + methodName + '` should ' + (isKeys ? 'not ' : '') + 'include inherited string keyed properties of string objects', function(assert) {
      assert.expect(1);

      stringProto.a = 1;

      var expected = isKeys ? ['0'] : ['0', 'a'],
          actual = func(Object('a')).sort();

      assert.deepEqual(actual, expected);

      delete stringProto.a;
    });

    QUnit.test('`_.' + methodName + '` should work with array-like objects', function(assert) {
      assert.expect(1);

      var object = { '0': 'a', 'length': 1 },
          actual = func(object).sort();

      assert.deepEqual(actual, ['0', 'length']);
    });

    QUnit.test('`_.' + methodName + '` should coerce primitives to objects (test in IE 9)', function(assert) {
      assert.expect(2);

      var expected = lodashStable.map(primitives, function(value) {
        return typeof value == 'string' ? ['0'] : [];
      });

      var actual = lodashStable.map(primitives, func);
      assert.deepEqual(actual, expected);

      // IE 9 doesn't box numbers in for-in loops.
      numberProto.a = 1;
      assert.deepEqual(func(0), isKeys ? [] : ['a']);
      delete numberProto.a;
    });

    QUnit.test('`_.' + methodName + '` skips the `constructor` property on prototype objects', function(assert) {
      assert.expect(3);

      function Foo() {}
      Foo.prototype.a = 1;

      var expected = ['a'];
      assert.deepEqual(func(Foo.prototype), expected);

      Foo.prototype = { 'constructor': Foo, 'a': 1 };
      assert.deepEqual(func(Foo.prototype), expected);

      var Fake = { 'prototype': {} };
      Fake.prototype.constructor = Fake;
      assert.deepEqual(func(Fake.prototype), ['constructor']);
    });

    QUnit.test('`_.' + methodName + '` should return an empty array when `object` is nullish', function(assert) {
      var values = [, null, undefined],
          expected = lodashStable.map(values, stubArray);

      var actual = lodashStable.map(values, function(value, index) {
        objectProto.a = 1;
        var result = index ? func(value) : func();
        delete objectProto.a;
        return result;
      });

      assert.deepEqual(actual, expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.last');

  (function() {
    var array = [1, 2, 3, 4];

    QUnit.test('should return the last element', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.last(array), 4);
    });

    QUnit.test('should return `undefined` when querying empty arrays', function(assert) {
      assert.expect(1);

      var array = [];
      array['-1'] = 1;

      assert.strictEqual(_.last([]), undefined);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.last);

      assert.deepEqual(actual, [3, 6, 9]);
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.strictEqual(_(array).last(), 4);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(array).chain().last() instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should not execute immediately when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _(array).chain().last();
        assert.strictEqual(wrapped.__wrapped__, array);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var largeArray = lodashStable.range(LARGE_ARRAY_SIZE),
            smallArray = array;

        lodashStable.times(2, function(index) {
          var array = index ? largeArray : smallArray,
              wrapped = _(array).filter(isEven);

          assert.strictEqual(wrapped.last(), _.last(_.filter(array, isEven)));
        });
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.lowerCase');

  (function() {
    QUnit.test('should lowercase as space-separated words', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.lowerCase('--Foo-Bar--'), 'foo bar');
      assert.strictEqual(_.lowerCase('fooBar'), 'foo bar');
      assert.strictEqual(_.lowerCase('__FOO_BAR__'), 'foo bar');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.lowerFirst');

  (function() {
    QUnit.test('should lowercase only the first character', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.lowerFirst('fred'), 'fred');
      assert.strictEqual(_.lowerFirst('Fred'), 'fred');
      assert.strictEqual(_.lowerFirst('FRED'), 'fRED');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.lt');

  (function() {
    QUnit.test('should return `true` if `value` is less than `other`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.lt(1, 3), true);
      assert.strictEqual(_.lt('abc', 'def'), true);
    });

    QUnit.test('should return `false` if `value` >= `other`', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.lt(3, 1), false);
      assert.strictEqual(_.lt(3, 3), false);
      assert.strictEqual(_.lt('def', 'abc'), false);
      assert.strictEqual(_.lt('def', 'def'), false);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.lte');

  (function() {
    QUnit.test('should return `true` if `value` is <= `other`', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.lte(1, 3), true);
      assert.strictEqual(_.lte(3, 3), true);
      assert.strictEqual(_.lte('abc', 'def'), true);
      assert.strictEqual(_.lte('def', 'def'), true);
    });

    QUnit.test('should return `false` if `value` > `other`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.lt(3, 1), false);
      assert.strictEqual(_.lt('def', 'abc'), false);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.findLastIndex and lodash.lastIndexOf');

  lodashStable.each(['findLastIndex', 'lastIndexOf'], function(methodName) {
    var array = [1, 2, 3, 1, 2, 3],
        func = _[methodName],
        resolve = methodName == 'findLastIndex' ? lodashStable.curry(lodashStable.eq) : identity;

    QUnit.test('`_.' + methodName + '` should return the index of the last matched value', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(3)), 5);
    });

    QUnit.test('`_.' + methodName + '` should work with a positive `fromIndex`', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(1), 2), 0);
    });

    QUnit.test('`_.' + methodName + '` should work with a `fromIndex` >= `length`', function(assert) {
      assert.expect(1);

      var values = [6, 8, Math.pow(2, 32), Infinity],
          expected = lodashStable.map(values, lodashStable.constant([-1, 3, -1]));

      var actual = lodashStable.map(values, function(fromIndex) {
        return [
          func(array, resolve(undefined), fromIndex),
          func(array, resolve(1), fromIndex),
          func(array, resolve(''), fromIndex)
        ];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with a negative `fromIndex`', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(2), -3), 1);
    });

    QUnit.test('`_.' + methodName + '` should work with a negative `fromIndex` <= `-length`', function(assert) {
      assert.expect(1);

      var values = [-6, -8, -Infinity],
          expected = lodashStable.map(values, stubZero);

      var actual = lodashStable.map(values, function(fromIndex) {
        return func(array, resolve(1), fromIndex);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should treat falsey `fromIndex` values correctly', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? 5 : -1;
      });

      var actual = lodashStable.map(falsey, function(fromIndex) {
        return func(array, resolve(3), fromIndex);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should coerce `fromIndex` to an integer', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array, resolve(2), 4.2), 4);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('indexOf methods');

  lodashStable.each(['indexOf', 'lastIndexOf', 'sortedIndexOf', 'sortedLastIndexOf'], function(methodName) {
    var func = _[methodName],
        isIndexOf = !/last/i.test(methodName),
        isSorted = /^sorted/.test(methodName);

    QUnit.test('`_.' + methodName + '` should accept a falsey `array` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, lodashStable.constant(-1));

      var actual = lodashStable.map(falsey, function(array, index) {
        try {
          return index ? func(array) : func();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return `-1` for an unmatched value', function(assert) {
      assert.expect(5);

      var array = [1, 2, 3],
          empty = [];

      assert.strictEqual(func(array, 4), -1);
      assert.strictEqual(func(array, 4, true), -1);
      assert.strictEqual(func(array, undefined, true), -1);

      assert.strictEqual(func(empty, undefined), -1);
      assert.strictEqual(func(empty, undefined, true), -1);
    });

    QUnit.test('`_.' + methodName + '` should not match values on empty arrays', function(assert) {
      assert.expect(2);

      var array = [];
      array[-1] = 0;

      assert.strictEqual(func(array, undefined), -1);
      assert.strictEqual(func(array, 0, true), -1);
    });

    QUnit.test('`_.' + methodName + '` should match `NaN`', function(assert) {
      assert.expect(3);

      var array = isSorted
        ? [1, 2, NaN, NaN]
        : [1, NaN, 3, NaN, 5, NaN];

      if (isSorted) {
        assert.strictEqual(func(array, NaN, true), isIndexOf ? 2 : 3);
        skipAssert(assert, 2);
      }
      else {
        assert.strictEqual(func(array, NaN), isIndexOf ? 1 : 5);
        assert.strictEqual(func(array, NaN, 2), isIndexOf ? 3 : 1);
        assert.strictEqual(func(array, NaN, -2), isIndexOf ? 5 : 3);
      }
    });

    QUnit.test('`_.' + methodName + '` should match `-0` as `0`', function(assert) {
      assert.expect(2);

      assert.strictEqual(func([-0], 0), 0);
      assert.strictEqual(func([0], -0), 0);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.map');

  (function() {
    var array = [1, 2];

    QUnit.test('should map values in `collection` to a new array', function(assert) {
      assert.expect(2);

      var object = { 'a': 1, 'b': 2 },
          expected = ['1', '2'];

      assert.deepEqual(_.map(array, String), expected);
      assert.deepEqual(_.map(object, String), expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': 'x' }, { 'a': 'y' }];
      assert.deepEqual(_.map(objects, 'a'), ['x', 'y']);
    });

    QUnit.test('should iterate over own string keyed properties of objects', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var actual = _.map(new Foo, identity);
      assert.deepEqual(actual, [1]);
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(2);

      var object = { 'a': 1, 'b': 2 },
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([1, 2]));

      lodashStable.each([array, object], function(collection) {
        var actual = lodashStable.map(values, function(value, index) {
          return index ? _.map(collection, value) : _.map(collection);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should accept a falsey `collection` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubArray);

      var actual = lodashStable.map(falsey, function(collection, index) {
        try {
          return index ? _.map(collection) : _.map();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should treat number values for `collection` as empty', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.map(1), []);
    });

    QUnit.test('should treat a nodelist as an array-like object', function(assert) {
      assert.expect(1);

      if (document) {
        var actual = _.map(document.getElementsByTagName('body'), function(element) {
          return element.nodeName.toLowerCase();
        });

        assert.deepEqual(actual, ['body']);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should work with objects with non-number length properties', function(assert) {
      assert.expect(1);

      var value = { 'value': 'x' },
          object = { 'length': { 'value': 'x' } };

      assert.deepEqual(_.map(object, identity), [value]);
    });

    QUnit.test('should return a wrapped value when chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(array).map(noop) instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should provide correct `predicate` arguments in a lazy sequence', function(assert) {
      assert.expect(5);

      if (!isNpm) {
        var args,
            array = lodashStable.range(LARGE_ARRAY_SIZE + 1),
            expected = [1, 0, _.map(array.slice(1), square)];

        _(array).slice(1).map(function(value, index, array) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, [1, 0, array.slice(1)]);

        args = undefined;
        _(array).slice(1).map(square).map(function(value, index, array) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, expected);

        args = undefined;
        _(array).slice(1).map(square).map(function(value, index) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, expected);

        args = undefined;
        _(array).slice(1).map(square).map(function(value) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, [1]);

        args = undefined;
        _(array).slice(1).map(square).map(function() {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, expected);
      }
      else {
        skipAssert(assert, 5);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.mapKeys');

  (function() {
    var array = [1, 2],
        object = { 'a': 1, 'b': 2 };

    QUnit.test('should map keys in `object` to a new object', function(assert) {
      assert.expect(1);

      var actual = _.mapKeys(object, String);
      assert.deepEqual(actual, { '1': 1, '2': 2 });
    });

    QUnit.test('should treat arrays like objects', function(assert) {
      assert.expect(1);

      var actual = _.mapKeys(array, String);
      assert.deepEqual(actual, { '1': 1, '2': 2 });
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var actual = _.mapKeys({ 'a': { 'b': 'c' } }, 'b');
      assert.deepEqual(actual, { 'c': { 'b': 'c' } });
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2 },
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant({ '1': 1, '2': 2 }));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.mapKeys(object, value) : _.mapKeys(object);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.mapValues');

  (function() {
    var array = [1, 2],
        object = { 'a': 1, 'b': 2 };

    QUnit.test('should map values in `object` to a new object', function(assert) {
      assert.expect(1);

      var actual = _.mapValues(object, String);
      assert.deepEqual(actual, { 'a': '1', 'b': '2' });
    });

    QUnit.test('should treat arrays like objects', function(assert) {
      assert.expect(1);

      var actual = _.mapValues(array, String);
      assert.deepEqual(actual, { '0': '1', '1': '2' });
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var actual = _.mapValues({ 'a': { 'b': 2 } }, 'b');
      assert.deepEqual(actual, { 'a': 2 });
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2 },
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([true, false]));

      var actual = lodashStable.map(values, function(value, index) {
        var result = index ? _.mapValues(object, value) : _.mapValues(object);
        return [lodashStable.isEqual(result, object), result === object];
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.mapKeys and lodash.mapValues');

  lodashStable.each(['mapKeys', 'mapValues'], function(methodName) {
    var func = _[methodName],
        object = { 'a': 1, 'b': 2 };

    QUnit.test('`_.' + methodName + '` should iterate over own string keyed properties of objects', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 'a';
      }
      Foo.prototype.b = 'b';

      var actual = func(new Foo, function(value, key) { return key; });
      assert.deepEqual(actual, { 'a': 'a' });
    });

    QUnit.test('`_.' + methodName + '` should accept a falsey `object` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubObject);

      var actual = lodashStable.map(falsey, function(object, index) {
        try {
          return index ? func(object) : func();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(object)[methodName](noop) instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  QUnit.module('lodash.matches');

  (function() {
    QUnit.test('should not change behavior if `source` is modified', function(assert) {
      assert.expect(9);

      var sources = [
        { 'a': { 'b': 2, 'c': 3 } },
        { 'a': 1, 'b': 2 },
        { 'a': 1 }
      ];

      lodashStable.each(sources, function(source, index) {
        var object = lodashStable.cloneDeep(source),
            par = _.matches(source);

        assert.strictEqual(par(object), true);

        if (index) {
          source.a = 2;
          source.b = 1;
          source.c = 3;
        } else {
          source.a.b = 1;
          source.a.c = 2;
          source.a.d = 3;
        }
        assert.strictEqual(par(object), true);
        assert.strictEqual(par(source), false);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('matches methods');

  lodashStable.each(['matches', 'isMatch'], function(methodName) {
    var isMatches = methodName == 'matches';

    function matches(source) {
      return isMatches ? _.matches(source) : function(object) {
        return _.isMatch(object, source);
      };
    }

    QUnit.test('`_.' + methodName + '` should perform a deep comparison between `source` and `object`', function(assert) {
      assert.expect(5);

      var object = { 'a': 1, 'b': 2, 'c': 3 },
          par = matches({ 'a': 1 });

      assert.strictEqual(par(object), true);

      par = matches({ 'b': 1 });
      assert.strictEqual(par(object), false);

      par = matches({ 'a': 1, 'c': 3 });
      assert.strictEqual(par(object), true);

      par = matches({ 'c': 3, 'd': 4 });
      assert.strictEqual(par(object), false);

      object = { 'a': { 'b': { 'c': 1, 'd': 2 }, 'e': 3 }, 'f': 4 };
      par = matches({ 'a': { 'b': { 'c': 1 } } });

      assert.strictEqual(par(object), true);
    });

    QUnit.test('`_.' + methodName + '` should match inherited string keyed `object` properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var object = { 'a': new Foo },
          par = matches({ 'a': { 'b': 2 } });

      assert.strictEqual(par(object), true);
    });

    QUnit.test('`_.' + methodName + '` should not match by inherited `source` properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var objects = [{ 'a': 1 }, { 'a': 1, 'b': 2 }],
          source = new Foo,
          actual = lodashStable.map(objects, matches(source)),
          expected = lodashStable.map(objects, stubTrue);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should compare a variety of `source` property values', function(assert) {
      assert.expect(2);

      var object1 = { 'a': false, 'b': true, 'c': '3', 'd': 4, 'e': [5], 'f': { 'g': 6 } },
          object2 = { 'a': 0, 'b': 1, 'c': 3, 'd': '4', 'e': ['5'], 'f': { 'g': '6' } },
          par = matches(object1);

      assert.strictEqual(par(object1), true);
      assert.strictEqual(par(object2), false);
    });

    QUnit.test('`_.' + methodName + '` should match `-0` as `0`', function(assert) {
      assert.expect(2);

      var object1 = { 'a': -0 },
          object2 = { 'a': 0 },
          par = matches(object1);

      assert.strictEqual(par(object2), true);

      par = matches(object2);
      assert.strictEqual(par(object1), true);
    });

    QUnit.test('`_.' + methodName + '` should compare functions by reference', function(assert) {
      assert.expect(3);

      var object1 = { 'a': lodashStable.noop },
          object2 = { 'a': noop },
          object3 = { 'a': {} },
          par = matches(object1);

      assert.strictEqual(par(object1), true);
      assert.strictEqual(par(object2), false);
      assert.strictEqual(par(object3), false);
    });

    QUnit.test('`_.' + methodName + '` should work with a function for `object`', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.a = { 'b': 2, 'c': 3 };

      var par = matches({ 'a': { 'b': 2 } });
      assert.strictEqual(par(Foo), true);
    });

    QUnit.test('`_.' + methodName + '` should work with a function for `source`', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.a = 1;
      Foo.b = function() {};
      Foo.c = 3;

      var objects = [{ 'a': 1 }, { 'a': 1, 'b': Foo.b, 'c': 3 }],
          actual = lodashStable.map(objects, matches(Foo));

      assert.deepEqual(actual, [false, true]);
    });

    QUnit.test('`_.' + methodName + '` should work with a non-plain `object`', function(assert) {
      assert.expect(1);

      function Foo(object) { lodashStable.assign(this, object); }

      var object = new Foo({ 'a': new Foo({ 'b': 2, 'c': 3 }) }),
          par = matches({ 'a': { 'b': 2 } });

      assert.strictEqual(par(object), true);
    });

    QUnit.test('`_.' + methodName + '` should partial match arrays', function(assert) {
      assert.expect(3);

      var objects = [{ 'a': ['b'] }, { 'a': ['c', 'd'] }],
          actual = lodashStable.filter(objects, matches({ 'a': ['d'] }));

      assert.deepEqual(actual, [objects[1]]);

      actual = lodashStable.filter(objects, matches({ 'a': ['b', 'd'] }));
      assert.deepEqual(actual, []);

      actual = lodashStable.filter(objects, matches({ 'a': ['d', 'b'] }));
      assert.deepEqual(actual, []);
    });

    QUnit.test('`_.' + methodName + '` should partial match arrays with duplicate values', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': [1, 2] }, { 'a': [2, 2] }],
          actual = lodashStable.filter(objects, matches({ 'a': [2, 2] }));

      assert.deepEqual(actual, [objects[1]]);
    });

    QUnit.test('should partial match arrays of objects', function(assert) {
      assert.expect(1);

      var objects = [
        { 'a': [{ 'b': 1, 'c': 2 }, { 'b': 4, 'c': 5, 'd': 6 }] },
        { 'a': [{ 'b': 1, 'c': 2 }, { 'b': 4, 'c': 6, 'd': 7 }] }
      ];

      var actual = lodashStable.filter(objects, matches({ 'a': [{ 'b': 1 }, { 'b': 4, 'c': 5 }] }));
      assert.deepEqual(actual, [objects[0]]);
    });

    QUnit.test('`_.' + methodName + '` should partial match maps', function(assert) {
      assert.expect(3);

      if (Map) {
        var objects = [{ 'a': new Map }, { 'a': new Map }];
        objects[0].a.set('a', 1);
        objects[1].a.set('a', 1);
        objects[1].a.set('b', 2);

        var map = new Map;
        map.set('b', 2);
        var actual = lodashStable.filter(objects, matches({ 'a': map }));

        assert.deepEqual(actual, [objects[1]]);

        map['delete']('b');
        actual = lodashStable.filter(objects, matches({ 'a': map }));

        assert.deepEqual(actual, objects);

        map.set('c', 3);
        actual = lodashStable.filter(objects, matches({ 'a': map }));

        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('`_.' + methodName + '` should partial match sets', function(assert) {
      assert.expect(3);

      if (Set) {
        var objects = [{ 'a': new Set }, { 'a': new Set }];
        objects[0].a.add(1);
        objects[1].a.add(1);
        objects[1].a.add(2);

        var set = new Set;
        set.add(2);
        var actual = lodashStable.filter(objects, matches({ 'a': set }));

        assert.deepEqual(actual, [objects[1]]);

        set['delete'](2);
        actual = lodashStable.filter(objects, matches({ 'a': set }));

        assert.deepEqual(actual, objects);

        set.add(3);
        actual = lodashStable.filter(objects, matches({ 'a': set }));

        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('`_.' + methodName + '` should match `undefined` values', function(assert) {
      assert.expect(3);

      var objects = [{ 'a': 1 }, { 'a': 1, 'b': 1 }, { 'a': 1, 'b': undefined }],
          actual = lodashStable.map(objects, matches({ 'b': undefined })),
          expected = [false, false, true];

      assert.deepEqual(actual, expected);

      actual = lodashStable.map(objects, matches({ 'a': 1, 'b': undefined }));

      assert.deepEqual(actual, expected);

      objects = [{ 'a': { 'b': 2 } }, { 'a': { 'b': 2, 'c': 3 } }, { 'a': { 'b': 2, 'c': undefined } }];
      actual = lodashStable.map(objects, matches({ 'a': { 'c': undefined } }));

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should match `undefined` values on primitives', function(assert) {
      assert.expect(3);

      numberProto.a = 1;
      numberProto.b = undefined;

      try {
        var par = matches({ 'b': undefined });
        assert.strictEqual(par(1), true);
      } catch (e) {
        assert.ok(false, e.message);
      }
      try {
        par = matches({ 'a': 1, 'b': undefined });
        assert.strictEqual(par(1), true);
      } catch (e) {
        assert.ok(false, e.message);
      }
      numberProto.a = { 'b': 1, 'c': undefined };
      try {
        par = matches({ 'a': { 'c': undefined } });
        assert.strictEqual(par(1), true);
      } catch (e) {
        assert.ok(false, e.message);
      }
      delete numberProto.a;
      delete numberProto.b;
    });

    QUnit.test('`_.' + methodName + '` should return `false` when `object` is nullish', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubFalse),
          par = matches({ 'a': 1 });

      var actual = lodashStable.map(values, function(value, index) {
        try {
          return index ? par(value) : par();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` hould return `true` when comparing an empty `source`', function(assert) {
      assert.expect(1);

      var object = { 'a': 1 },
          expected = lodashStable.map(empties, stubTrue);

      var actual = lodashStable.map(empties, function(value) {
        var par = matches(value);
        return par(object);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return `true` when comparing an empty `source` to a nullish `object`', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubTrue),
          par = matches({});

      var actual = lodashStable.map(values, function(value, index) {
        try {
          return index ? par(value) : par();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return `true` when comparing a `source` of empty arrays and objects', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': [1], 'b': { 'c': 1 } }, { 'a': [2, 3], 'b': { 'd': 2 } }],
          actual = lodashStable.filter(objects, matches({ 'a': [], 'b': {} }));

      assert.deepEqual(actual, objects);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.matchesProperty');

  (function() {
    QUnit.test('should create a function that performs a deep comparison between a property value and `srcValue`', function(assert) {
      assert.expect(6);

      var object = { 'a': 1, 'b': 2, 'c': 3 },
          matches = _.matchesProperty('a', 1);

      assert.strictEqual(matches.length, 1);
      assert.strictEqual(matches(object), true);

      matches = _.matchesProperty('b', 3);
      assert.strictEqual(matches(object), false);

      matches = _.matchesProperty('a', { 'a': 1, 'c': 3 });
      assert.strictEqual(matches({ 'a': object }), true);

      matches = _.matchesProperty('a', { 'c': 3, 'd': 4 });
      assert.strictEqual(matches(object), false);

      object = { 'a': { 'b': { 'c': 1, 'd': 2 }, 'e': 3 }, 'f': 4 };
      matches = _.matchesProperty('a', { 'b': { 'c': 1 } });

      assert.strictEqual(matches(object), true);
    });

    QUnit.test('should support deep paths', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': 2 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var matches = _.matchesProperty(path, 2);
        assert.strictEqual(matches(object), true);
      });
    });

    QUnit.test('should work with a non-string `path`', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3];

      lodashStable.each([1, [1]], function(path) {
        var matches = _.matchesProperty(path, 2);
        assert.strictEqual(matches(array), true);
      });
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object1 = { '-0': 'a' },
          object2 = { '0': 'b' },
          pairs = [[object1, object2], [object1, object2], [object2, object1], [object2, object1]],
          props = [-0, Object(-0), 0, Object(0)],
          values = ['a', 'a', 'b', 'b'],
          expected = lodashStable.map(props, lodashStable.constant([true, false]));

      var actual = lodashStable.map(props, function(key, index) {
        var matches = _.matchesProperty(key, values[index]),
            pair = pairs[index];

        return [matches(pair[0]), matches(pair[1])];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should coerce key to a string', function(assert) {
      assert.expect(1);

      function fn() {}
      fn.toString = lodashStable.constant('fn');

      var objects = [{ 'null': 1 }, { 'undefined': 2 }, { 'fn': 3 }, { '[object Object]': 4 }],
          values = [null, undefined, fn, {}];

      var expected = lodashStable.transform(values, function(result) {
        result.push(true, true);
      });

      var actual = lodashStable.transform(objects, function(result, object, index) {
        var key = values[index];
        lodashStable.each([key, [key]], function(path) {
          var matches = _.matchesProperty(path, object[key]);
          result.push(matches(object));
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should match a key over a path', function(assert) {
      assert.expect(2);

      var object = { 'a.b': 1, 'a': { 'b': 2 } };

      lodashStable.each(['a.b', ['a.b']], function(path) {
        var matches = _.matchesProperty(path, 1);
        assert.strictEqual(matches(object), true);
      });
    });

    QUnit.test('should return `false` when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubFalse);

      lodashStable.each(['constructor', ['constructor']], function(path) {
        var matches = _.matchesProperty(path, 1);

        var actual = lodashStable.map(values, function(value, index) {
          try {
            return index ? matches(value) : matches();
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `false` for deep paths when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubFalse);

      lodashStable.each(['constructor.prototype.valueOf', ['constructor', 'prototype', 'valueOf']], function(path) {
        var matches = _.matchesProperty(path, 1);

        var actual = lodashStable.map(values, function(value, index) {
          try {
            return index ? matches(value) : matches();
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `false` if parts of `path` are missing', function(assert) {
      assert.expect(4);

      var object = {};

      lodashStable.each(['a', 'a[1].b.c', ['a'], ['a', '1', 'b', 'c']], function(path) {
        var matches = _.matchesProperty(path, 1);
        assert.strictEqual(matches(object), false);
      });
    });

    QUnit.test('should match inherited string keyed `srcValue` properties', function(assert) {
      assert.expect(2);

      function Foo() {}
      Foo.prototype.b = 2;

      var object = { 'a': new Foo };

      lodashStable.each(['a', ['a']], function(path) {
        var matches = _.matchesProperty(path, { 'b': 2 });
        assert.strictEqual(matches(object), true);
      });
    });

    QUnit.test('should not match by inherited `srcValue` properties', function(assert) {
      assert.expect(2);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var objects = [{ 'a': { 'a': 1 } }, { 'a': { 'a': 1, 'b': 2 } }],
          expected = lodashStable.map(objects, stubTrue);

      lodashStable.each(['a', ['a']], function(path) {
        assert.deepEqual(lodashStable.map(objects, _.matchesProperty(path, new Foo)), expected);
      });
    });

    QUnit.test('should compare a variety of values', function(assert) {
      assert.expect(2);

      var object1 = { 'a': false, 'b': true, 'c': '3', 'd': 4, 'e': [5], 'f': { 'g': 6 } },
          object2 = { 'a': 0, 'b': 1, 'c': 3, 'd': '4', 'e': ['5'], 'f': { 'g': '6' } },
          matches = _.matchesProperty('a', object1);

      assert.strictEqual(matches({ 'a': object1 }), true);
      assert.strictEqual(matches({ 'a': object2 }), false);
    });

    QUnit.test('should match `-0` as `0`', function(assert) {
      assert.expect(2);

      var matches = _.matchesProperty('a', -0);
      assert.strictEqual(matches({ 'a': 0 }), true);

      matches = _.matchesProperty('a', 0);
      assert.strictEqual(matches({ 'a': -0 }), true);
    });

    QUnit.test('should compare functions by reference', function(assert) {
      assert.expect(3);

      var object1 = { 'a': lodashStable.noop },
          object2 = { 'a': noop },
          object3 = { 'a': {} },
          matches = _.matchesProperty('a', object1);

      assert.strictEqual(matches({ 'a': object1 }), true);
      assert.strictEqual(matches({ 'a': object2 }), false);
      assert.strictEqual(matches({ 'a': object3 }), false);
    });

    QUnit.test('should work with a function for `srcValue`', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.a = 1;
      Foo.b = function() {};
      Foo.c = 3;

      var objects = [{ 'a': { 'a': 1 } }, { 'a': { 'a': 1, 'b': Foo.b, 'c': 3 } }],
          actual = lodashStable.map(objects, _.matchesProperty('a', Foo));

      assert.deepEqual(actual, [false, true]);
    });

    QUnit.test('should work with a non-plain `srcValue`', function(assert) {
      assert.expect(1);

      function Foo(object) { lodashStable.assign(this, object); }

      var object = new Foo({ 'a': new Foo({ 'b': 1, 'c': 2 }) }),
          matches = _.matchesProperty('a', { 'b': 1 });

      assert.strictEqual(matches(object), true);
    });

    QUnit.test('should partial match arrays', function(assert) {
      assert.expect(3);

      var objects = [{ 'a': ['b'] }, { 'a': ['c', 'd'] }],
          actual = lodashStable.filter(objects, _.matchesProperty('a', ['d']));

      assert.deepEqual(actual, [objects[1]]);

      actual = lodashStable.filter(objects, _.matchesProperty('a', ['b', 'd']));
      assert.deepEqual(actual, []);

      actual = lodashStable.filter(objects, _.matchesProperty('a', ['d', 'b']));
      assert.deepEqual(actual, []);
    });

    QUnit.test('should partial match arrays with duplicate values', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': [1, 2] }, { 'a': [2, 2] }],
          actual = lodashStable.filter(objects, _.matchesProperty('a', [2, 2]));

      assert.deepEqual(actual, [objects[1]]);
    });

    QUnit.test('should partial match arrays of objects', function(assert) {
      assert.expect(1);

      var objects = [
        { 'a': [{ 'a': 1, 'b': 2 }, { 'a': 4, 'b': 5, 'c': 6 }] },
        { 'a': [{ 'a': 1, 'b': 2 }, { 'a': 4, 'b': 6, 'c': 7 }] }
      ];

      var actual = lodashStable.filter(objects, _.matchesProperty('a', [{ 'a': 1 }, { 'a': 4, 'b': 5 }]));
      assert.deepEqual(actual, [objects[0]]);
    });
    QUnit.test('should partial match maps', function(assert) {
      assert.expect(3);

      if (Map) {
        var objects = [{ 'a': new Map }, { 'a': new Map }];
        objects[0].a.set('a', 1);
        objects[1].a.set('a', 1);
        objects[1].a.set('b', 2);

        var map = new Map;
        map.set('b', 2);
        var actual = lodashStable.filter(objects, _.matchesProperty('a', map));

        assert.deepEqual(actual, [objects[1]]);

        map['delete']('b');
        actual = lodashStable.filter(objects, _.matchesProperty('a', map));

        assert.deepEqual(actual, objects);

        map.set('c', 3);
        actual = lodashStable.filter(objects, _.matchesProperty('a', map));

        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should partial match sets', function(assert) {
      assert.expect(3);

      if (Set) {
        var objects = [{ 'a': new Set }, { 'a': new Set }];
        objects[0].a.add(1);
        objects[1].a.add(1);
        objects[1].a.add(2);

        var set = new Set;
        set.add(2);
        var actual = lodashStable.filter(objects, _.matchesProperty('a', set));

        assert.deepEqual(actual, [objects[1]]);

        set['delete'](2);
        actual = lodashStable.filter(objects, _.matchesProperty('a', set));

        assert.deepEqual(actual, objects);

        set.add(3);
        actual = lodashStable.filter(objects, _.matchesProperty('a', set));

        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should match `undefined` values', function(assert) {
      assert.expect(2);

      var objects = [{ 'a': 1 }, { 'a': 1, 'b': 1 }, { 'a': 1, 'b': undefined }],
          actual = lodashStable.map(objects, _.matchesProperty('b', undefined)),
          expected = [false, false, true];

      assert.deepEqual(actual, expected);

      objects = [{ 'a': { 'a': 1 } }, { 'a': { 'a': 1, 'b': 1 } }, { 'a': { 'a': 1, 'b': undefined } }];
      actual = lodashStable.map(objects, _.matchesProperty('a', { 'b': undefined }));

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should match `undefined` values of nested objects', function(assert) {
      assert.expect(4);

      var object = { 'a': { 'b': undefined } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var matches = _.matchesProperty(path, undefined);
        assert.strictEqual(matches(object), true);
      });

      lodashStable.each(['a.a', ['a', 'a']], function(path) {
        var matches = _.matchesProperty(path, undefined);
        assert.strictEqual(matches(object), false);
      });
    });

    QUnit.test('should match `undefined` values on primitives', function(assert) {
      assert.expect(2);

      numberProto.a = 1;
      numberProto.b = undefined;

      try {
        var matches = _.matchesProperty('b', undefined);
        assert.strictEqual(matches(1), true);
      } catch (e) {
        assert.ok(false, e.message);
      }
      numberProto.a = { 'b': 1, 'c': undefined };
      try {
        matches = _.matchesProperty('a', { 'c': undefined });
        assert.strictEqual(matches(1), true);
      } catch (e) {
        assert.ok(false, e.message);
      }
      delete numberProto.a;
      delete numberProto.b;
    });

    QUnit.test('should return `true` when comparing a `srcValue` of empty arrays and objects', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': [1], 'b': { 'c': 1 } }, { 'a': [2, 3], 'b': { 'd': 2 } }],
          matches = _.matchesProperty('a', { 'a': [], 'b': {} });

      var actual = lodashStable.filter(objects, function(object) {
        return matches({ 'a': object });
      });

      assert.deepEqual(actual, objects);
    });

    QUnit.test('should not change behavior if `srcValue` is modified', function(assert) {
      assert.expect(9);

      lodashStable.each([{ 'a': { 'b': 2, 'c': 3 } }, { 'a': 1, 'b': 2 }, { 'a': 1 }], function(source, index) {
        var object = lodashStable.cloneDeep(source),
            matches = _.matchesProperty('a', source);

        assert.strictEqual(matches({ 'a': object }), true);

        if (index) {
          source.a = 2;
          source.b = 1;
          source.c = 3;
        } else {
          source.a.b = 1;
          source.a.c = 2;
          source.a.d = 3;
        }
        assert.strictEqual(matches({ 'a': object }), true);
        assert.strictEqual(matches({ 'a': source }), false);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.max');

  (function() {
    QUnit.test('should return the largest value from a collection', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.max([1, 2, 3]), 3);
    });

    QUnit.test('should return `undefined` for empty collections', function(assert) {
      assert.expect(1);

      var values = falsey.concat([[]]),
          expected = lodashStable.map(values, noop);

      var actual = lodashStable.map(values, function(value, index) {
        try {
          return index ? _.max(value) : _.max();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with non-numeric collection values', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.max(['a', 'b']), 'b');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.mean');

  (function() {
    QUnit.test('should return the mean of an array of numbers', function(assert) {
      assert.expect(1);

      var array = [4, 2, 8, 6];
      assert.strictEqual(_.mean(array), 5);
    });

    QUnit.test('should return `NaN` when passing empty `array` values', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, stubNaN),
          actual = lodashStable.map(empties, _.mean);

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.meanBy');

  (function() {
    var objects = [{ 'a': 2 }, { 'a': 3 }, { 'a': 1 }];

    QUnit.test('should work with an `iteratee` argument', function(assert) {
      assert.expect(1);

      var actual = _.meanBy(objects, function(object) {
        return object.a;
      });

      assert.deepEqual(actual, 2);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.meanBy(objects, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [{ 'a': 2 }]);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var arrays = [[2], [3], [1]];
      assert.strictEqual(_.meanBy(arrays, 0), 2);
      assert.strictEqual(_.meanBy(objects, 'a'), 2);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.memoize');

  (function() {
    QUnit.test('should memoize results based on the first argument given', function(assert) {
      assert.expect(2);

      var memoized = _.memoize(function(a, b, c) {
        return a + b + c;
      });

      assert.strictEqual(memoized(1, 2, 3), 6);
      assert.strictEqual(memoized(1, 3, 5), 6);
    });

    QUnit.test('should support a `resolver` argument', function(assert) {
      assert.expect(2);

      var fn = function(a, b, c) { return a + b + c; },
          memoized = _.memoize(fn, fn);

      assert.strictEqual(memoized(1, 2, 3), 6);
      assert.strictEqual(memoized(1, 3, 5), 9);
    });

    QUnit.test('should use `this` binding of function for `resolver`', function(assert) {
      assert.expect(2);

      var fn = function(a, b, c) { return a + this.b + this.c; },
          memoized = _.memoize(fn, fn);

      var object = { 'memoized': memoized, 'b': 2, 'c': 3 };
      assert.strictEqual(object.memoized(1), 6);

      object.b = 3;
      object.c = 5;
      assert.strictEqual(object.memoized(1), 9);
    });

    QUnit.test('should throw a TypeError if `resolve` is truthy and not a function', function(assert) {
      assert.expect(1);

      assert.raises(function() { _.memoize(noop, true); }, TypeError);
    });

    QUnit.test('should not error if `resolver` is falsey', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubTrue);

      var actual = lodashStable.map(falsey, function(resolver, index) {
        try {
          return _.isFunction(index ? _.memoize(noop, resolver) : _.memoize(noop));
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should check cache for own properties', function(assert) {
      assert.expect(1);

      var props = [
        'constructor',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'toLocaleString',
        'toString',
        'valueOf'
      ];

      var memoized = _.memoize(identity);

      var actual = lodashStable.map(props, function(value) {
        return memoized(value);
      });

      assert.deepEqual(actual, props);
    });

    QUnit.test('should cache the `__proto__` key', function(assert) {
      assert.expect(8);

      var array = [],
          key = '__proto__';

      lodashStable.times(2, function(index) {
        var count = 0,
            resolver = index && identity;

        var memoized = _.memoize(function() {
          count++;
          return array;
        }, resolver);

        var cache = memoized.cache;

        memoized(key);
        memoized(key);

        assert.strictEqual(count, 1);
        assert.strictEqual(cache.get(key), array);
        assert.notOk(cache.__data__ instanceof Array);
        assert.strictEqual(cache['delete'](key), true);
      });
    });

    QUnit.test('should allow `_.memoize.Cache` to be customized', function(assert) {
      assert.expect(4);

      var oldCache = _.memoize.Cache;

      function Cache() {
        this.__data__ = [];
      }

      Cache.prototype = {
        'get': function(key) {
          var entry = _.find(this.__data__, function(entry) {
            return key === entry.key;
          });
          return entry && entry.value;
        },
        'has': function(key) {
          return _.some(this.__data__, function(entry) {
            return key === entry.key;
          });
        },
        'set': function(key, value) {
          this.__data__.push({ 'key': key, 'value': value });
          return this;
        }
      };

      _.memoize.Cache = Cache;

      var memoized = _.memoize(function(object) {
        return 'value:' + object.id;
      });

      var cache = memoized.cache,
          key1 = { 'id': 'a' },
          key2 = { 'id': 'b' };

      assert.strictEqual(memoized(key1), 'value:a');
      assert.strictEqual(cache.has(key1), true);

      assert.strictEqual(memoized(key2), 'value:b');
      assert.strictEqual(cache.has(key2), true);

      _.memoize.Cache = oldCache;
    });

    QUnit.test('should works with an immutable `_.memoize.Cache` ', function(assert) {
      assert.expect(2);

      var oldCache = _.memoize.Cache;

      function Cache() {
        this.__data__ = [];
      }

      Cache.prototype = {
        'get': function(key) {
          return _.find(this.__data__, function(entry) {
            return key === entry.key;
          }).value;
        },
        'has': function(key) {
          return _.some(this.__data__, function(entry) {
            return key === entry.key;
          });
        },
        'set': function(key, value) {
          var result = new Cache;
          result.__data__ = this.__data__.concat({ 'key': key, 'value': value });
          return result;
        }
      };

      _.memoize.Cache = Cache;

      var memoized = _.memoize(function(object) {
        return object.id;
      });

      var key1 = { 'id': 'a' },
          key2 = { 'id': 'b' };

      memoized(key1);
      memoized(key2);

      var cache = memoized.cache;
      assert.strictEqual(cache.has(key1), true);
      assert.strictEqual(cache.has(key2), true);

      _.memoize.Cache = oldCache;
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.merge');

  (function() {
    var args = arguments;

    QUnit.test('should merge `source` into `object`', function(assert) {
      assert.expect(1);

      var names = {
        'characters': [
          { 'name': 'barney' },
          { 'name': 'fred' }
        ]
      };

      var ages = {
        'characters': [
          { 'age': 36 },
          { 'age': 40 }
        ]
      };

      var heights = {
        'characters': [
          { 'height': '5\'4"' },
          { 'height': '5\'5"' }
        ]
      };

      var expected = {
        'characters': [
          { 'name': 'barney', 'age': 36, 'height': '5\'4"' },
          { 'name': 'fred', 'age': 40, 'height': '5\'5"' }
        ]
      };

      assert.deepEqual(_.merge(names, ages, heights), expected);
    });

    QUnit.test('should merge sources containing circular references', function(assert) {
      assert.expect(2);

      var object = {
        'foo': { 'a': 1 },
        'bar': { 'a': 2 }
      };

      var source = {
        'foo': { 'b': { 'c': { 'd': {} } } },
        'bar': {}
      };

      source.foo.b.c.d = source;
      source.bar.b = source.foo.b;

      var actual = _.merge(object, source);

      assert.notStrictEqual(actual.bar.b, actual.foo.b);
      assert.strictEqual(actual.foo.b.c.d, actual.foo.b.c.d.foo.b.c.d);
    });

    QUnit.test('should work with four arguments', function(assert) {
      assert.expect(1);

      var expected = { 'a': 4 },
          actual = _.merge({ 'a': 1 }, { 'a': 2 }, { 'a': 3 }, expected);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should merge onto function `object` values', function(assert) {
      assert.expect(2);

      function Foo() {}

      var source = { 'a': 1 },
          actual = _.merge(Foo, source);

      assert.strictEqual(actual, Foo);
      assert.strictEqual(Foo.a, 1);
    });

    QUnit.test('should not merge onto function values of sources', function(assert) {
      assert.expect(3);

      var source1 = { 'a': function() {} },
          source2 = { 'a': { 'b': 2 } },
          actual = _.merge({}, source1, source2);

      assert.deepEqual(actual, { 'a': { 'b': 2 } });

      actual = _.merge(source1, source2);

      assert.strictEqual(typeof actual.a, 'function');
      assert.strictEqual(actual.a.b, 2);
    });

    QUnit.test('should merge onto non-plain `object` values', function(assert) {
      assert.expect(2);

      function Foo() {}

      var object = new Foo,
          actual = _.merge(object, { 'a': 1 });

      assert.strictEqual(actual, object);
      assert.strictEqual(object.a, 1);
    });

    QUnit.test('should treat sparse array sources as dense', function(assert) {
      assert.expect(2);

      var array = [1];
      array[2] = 3;

      var actual = _.merge([], array),
          expected = array.slice();

      expected[1] = undefined;

      assert.ok('1' in actual);
      assert.deepEqual(actual, expected);
    });

    QUnit.test('should merge `arguments` objects', function(assert) {
      assert.expect(7);

      var object1 = { 'value': args },
          object2 = { 'value': { '3': 4 } },
          expected = { '0': 1, '1': 2, '2': 3, '3': 4 },
          actual = _.merge(object1, object2);

      assert.notOk('3' in args);
      assert.notOk(_.isArguments(actual.value));
      assert.deepEqual(actual.value, expected);
      object1.value = args;

      actual = _.merge(object2, object1);
      assert.notOk(_.isArguments(actual.value));
      assert.deepEqual(actual.value, expected);

      expected = { '0': 1, '1': 2, '2': 3 };

      actual = _.merge({}, object1);
      assert.notOk(_.isArguments(actual.value));
      assert.deepEqual(actual.value, expected);
    });

    QUnit.test('should merge typed arrays', function(assert) {
      assert.expect(4);

      var array1 = [0],
          array2 = [0, 0],
          array3 = [0, 0, 0, 0],
          array4 = [0, 0, 0, 0, 0, 0, 0, 0];

      var arrays = [array2, array1, array4, array3, array2, array4, array4, array3, array2],
          buffer = ArrayBuffer && new ArrayBuffer(8);

      // Juggle for `Float64Array` shim.
      if (root.Float64Array && (new Float64Array(buffer)).length == 8) {
        arrays[1] = array4;
      }
      var expected = lodashStable.map(typedArrays, function(type, index) {
        var array = arrays[index].slice();
        array[0] = 1;
        return root[type] ? { 'value': array } : false;
      });

      var actual = lodashStable.map(typedArrays, function(type) {
        var Ctor = root[type];
        return Ctor ? _.merge({ 'value': new Ctor(buffer) }, { 'value': [1] }) : false;
      });

      assert.ok(lodashStable.isArray(actual));
      assert.deepEqual(actual, expected);

      expected = lodashStable.map(typedArrays, function(type, index) {
        var array = arrays[index].slice();
        array.push(1);
        return root[type] ? { 'value': array } : false;
      });

      actual = lodashStable.map(typedArrays, function(type, index) {
        var Ctor = root[type],
            array = lodashStable.range(arrays[index].length);

        array.push(1);
        return Ctor ? _.merge({ 'value': array }, { 'value': new Ctor(buffer) }) : false;
      });

      assert.ok(lodashStable.isArray(actual));
      assert.deepEqual(actual, expected);
    });

    QUnit.test('should assign `null` values', function(assert) {
      assert.expect(1);

      var actual = _.merge({ 'a': 1 }, { 'a': null });
      assert.strictEqual(actual.a, null);
    });

    QUnit.test('should assign non array/typed-array/plain-object sources directly', function(assert) {
      assert.expect(1);

      function Foo() {}

      var values = [new Foo, new Boolean, new Date, Foo, new Number, new String, new RegExp],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        var object = _.merge({}, { 'value': value });
        return object.value === value;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should deep clone array/typed-array/plain-object sources', function(assert) {
      assert.expect(1);

      var typedArray = Uint8Array
        ? new Uint8Array(new ArrayBuffer(2))
        : { 'buffer': [0, 0] };

      var props = ['0', 'a', 'buffer'],
          values = [[{ 'a': 1 }], { 'a': [1] }, typedArray],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value, index) {
        var key = props[index],
            object = _.merge({}, { 'value': value }),
            newValue = object.value;

        return (
          newValue !== value &&
          newValue[key] !== value[key] &&
          lodashStable.isEqual(newValue, value)
        );
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not augment source objects', function(assert) {
      assert.expect(6);

      var source1 = { 'a': [{ 'a': 1 }] },
          source2 = { 'a': [{ 'b': 2 }] },
          actual = _.merge({}, source1, source2);

      assert.deepEqual(source1.a, [{ 'a': 1 }]);
      assert.deepEqual(source2.a, [{ 'b': 2 }]);
      assert.deepEqual(actual.a, [{ 'a': 1, 'b': 2 }]);

      var source1 = { 'a': [[1, 2, 3]] },
          source2 = { 'a': [[3, 4]] },
          actual = _.merge({}, source1, source2);

      assert.deepEqual(source1.a, [[1, 2, 3]]);
      assert.deepEqual(source2.a, [[3, 4]]);
      assert.deepEqual(actual.a, [[3, 4, 3]]);
    });

    QUnit.test('should merge plain-objects onto non plain-objects', function(assert) {
      assert.expect(4);

      function Foo(object) {
        lodashStable.assign(this, object);
      }

      var object = { 'a': 1 },
          actual = _.merge(new Foo, object);

      assert.ok(actual instanceof Foo);
      assert.deepEqual(actual, new Foo(object));

      actual = _.merge([new Foo], [object]);
      assert.ok(actual[0] instanceof Foo);
      assert.deepEqual(actual, [new Foo(object)]);
    });

    QUnit.test('should not assign `undefined` values', function(assert) {
      assert.expect(1);

      var actual = _.merge({ 'a': 1 }, { 'a': undefined, 'b': undefined });
      assert.deepEqual(actual, { 'a': 1 });
    });

    QUnit.test('should skip `undefined` values in array sources if a destination value exists', function(assert) {
      assert.expect(2);

      var array = [1];
      array[2] = 3;

      var actual = _.merge([4, 5, 6], array),
          expected = [1, 5, 3];

      assert.deepEqual(actual, expected);

      array = [1, , 3];
      array[1] = undefined;

      actual = _.merge([4, 5, 6], array);
      assert.deepEqual(actual, expected);
    });

    QUnit.test('should skip merging when `object` and `source` are the same value', function(assert) {
      assert.expect(1);

      var object = {},
          pass = true;

      defineProperty(object, 'a', {
        'enumerable': true,
        'configurable': true,
        'get': function() { pass = false; },
        'set': function() { pass = false; }
      });

      _.merge(object, object);
      assert.ok(pass);
    });

    QUnit.test('should convert values to arrays when merging arrays of `source`', function(assert) {
      assert.expect(2);

      var object = { 'a': { '1': 'y', 'b': 'z', 'length': 2 } },
          actual = _.merge(object, { 'a': ['x'] });

      assert.deepEqual(actual, { 'a': ['x', 'y'] });

      actual = _.merge({ 'a': {} }, { 'a': [] });
      assert.deepEqual(actual, { 'a': [] });
    });

    QUnit.test('should not convert strings to arrays when merging arrays of `source`', function(assert) {
      assert.expect(1);

      var object = { 'a': 'abcde' },
          actual = _.merge(object, { 'a': ['x', 'y', 'z'] });

      assert.deepEqual(actual, { 'a': ['x', 'y', 'z'] });
    });

    QUnit.test('should not error on DOM elements', function(assert) {
      assert.expect(1);

      var object1 = { 'el': document && document.createElement('div') },
          object2 = { 'el': document && document.createElement('div') },
          pairs = [[{}, object1], [object1, object2]],
          expected = lodashStable.map(pairs, stubTrue);

      var actual = lodashStable.map(pairs, function(pair) {
        try {
          return _.merge(pair[0], pair[1]).el === pair[1].el;
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.mergeWith');

  (function() {
    QUnit.test('should handle merging when `customizer` returns `undefined`', function(assert) {
      assert.expect(2);

      var actual = _.mergeWith({ 'a': { 'b': [1, 1] } }, { 'a': { 'b': [0] } }, noop);
      assert.deepEqual(actual, { 'a': { 'b': [0, 1] } });

      actual = _.mergeWith([], [undefined], identity);
      assert.deepEqual(actual, [undefined]);
    });

    QUnit.test('should clone sources when `customizer` returns `undefined`', function(assert) {
      assert.expect(1);

      var source1 = { 'a': { 'b': { 'c': 1 } } },
          source2 = { 'a': { 'b': { 'd': 2 } } };

      _.mergeWith({}, source1, source2, noop);
      assert.deepEqual(source1.a.b, { 'c': 1 });
    });

    QUnit.test('should defer to `customizer` for non `undefined` results', function(assert) {
      assert.expect(1);

      var actual = _.mergeWith({ 'a': { 'b': [0, 1] } }, { 'a': { 'b': [2] } }, function(a, b) {
        return lodashStable.isArray(a) ? a.concat(b) : undefined;
      });

      assert.deepEqual(actual, { 'a': { 'b': [0, 1, 2] } });
    });

    QUnit.test('should provide `stack` to `customizer`', function(assert) {
      assert.expect(1);

      var actual;

      _.mergeWith({}, { 'a': { 'b': 2 } }, function() {
        actual = _.last(arguments);
      });

      assert.ok(isNpm
        ? actual.constructor.name == 'Stack'
        : actual instanceof mapCaches.Stack
      );
    });

    QUnit.test('should overwrite primitives with source object clones', function(assert) {
      assert.expect(1);

      var actual = _.mergeWith({ 'a': 0 }, { 'a': { 'b': ['c'] } }, function(a, b) {
        return lodashStable.isArray(a) ? a.concat(b) : undefined;
      });

      assert.deepEqual(actual, { 'a': { 'b': ['c'] } });
    });

    QUnit.test('should pop the stack of sources for each sibling property', function(assert) {
      assert.expect(1);

      var array = ['b', 'c'],
          object = { 'a': ['a'] },
          source = { 'a': array, 'b': array };

      var actual = _.mergeWith(object, source, function(a, b) {
        return lodashStable.isArray(a) ? a.concat(b) : undefined;
      });

      assert.deepEqual(actual, { 'a': ['a', 'b', 'c'], 'b': ['b', 'c'] });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.method');

  (function() {
    QUnit.test('should create a function that calls a method of a given object', function(assert) {
      assert.expect(4);

      var object = { 'a': stubOne };

      lodashStable.each(['a', ['a']], function(path) {
        var method = _.method(path);
        assert.strictEqual(method.length, 1);
        assert.strictEqual(method(object), 1);
      });
    });

    QUnit.test('should work with deep property values', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': stubTwo } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var method = _.method(path);
        assert.strictEqual(method(object), 2);
      });
    });

    QUnit.test('should work with a non-string `path`', function(assert) {
      assert.expect(2);

      var array = lodashStable.times(3, _.constant);

      lodashStable.each([1, [1]], function(path) {
        var method = _.method(path);
        assert.strictEqual(method(array), 1);
      });
    });

    QUnit.test('should coerce key to a string', function(assert) {
      assert.expect(1);

      function fn() {}
      fn.toString = lodashStable.constant('fn');

      var expected = [1, 1, 2, 2, 3, 3, 4, 4],
          objects = [{ 'null': stubOne }, { 'undefined': stubTwo }, { 'fn': stubThree }, { '[object Object]': stubFour }],
          values = [null, undefined, fn, {}];

      var actual = lodashStable.transform(objects, function(result, object, index) {
        var key = values[index];
        lodashStable.each([key, [key]], function(path) {
          var method = _.method(key);
          result.push(method(object));
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with inherited property values', function(assert) {
      assert.expect(2);

      function Foo() {}
      Foo.prototype.a = stubOne;

      lodashStable.each(['a', ['a']], function(path) {
        var method = _.method(path);
        assert.strictEqual(method(new Foo), 1);
      });
    });

    QUnit.test('should use a key over a path', function(assert) {
      assert.expect(2);

      var object = { 'a.b': stubOne, 'a': { 'b': stubTwo } };

      lodashStable.each(['a.b', ['a.b']], function(path) {
        var method = _.method(path);
        assert.strictEqual(method(object), 1);
      });
    });

    QUnit.test('should return `undefined` when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor', ['constructor']], function(path) {
        var method = _.method(path);

        var actual = lodashStable.map(values, function(value, index) {
          return index ? method(value) : method();
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` with deep paths when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor.prototype.valueOf', ['constructor', 'prototype', 'valueOf']], function(path) {
        var method = _.method(path);

        var actual = lodashStable.map(values, function(value, index) {
          return index ? method(value) : method();
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` if parts of `path` are missing', function(assert) {
      assert.expect(4);

      var object = {};

      lodashStable.each(['a', 'a[1].b.c', ['a'], ['a', '1', 'b', 'c']], function(path) {
        var method = _.method(path);
        assert.strictEqual(method(object), undefined);
      });
    });

    QUnit.test('should apply partial arguments to function', function(assert) {
      assert.expect(2);

      var object = {
        'fn': function() {
          return slice.call(arguments);
        }
      };

      lodashStable.each(['fn', ['fn']], function(path) {
        var method = _.method(path, 1, 2, 3);
        assert.deepEqual(method(object), [1, 2, 3]);
      });
    });

    QUnit.test('should invoke deep property methods with the correct `this` binding', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': function() { return this.c; }, 'c': 1 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var method = _.method(path);
        assert.strictEqual(method(object), 1);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.methodOf');

  (function() {
    QUnit.test('should create a function that calls a method of a given key', function(assert) {
      assert.expect(4);

      var object = { 'a': stubOne };

      lodashStable.each(['a', ['a']], function(path) {
        var methodOf = _.methodOf(object);
        assert.strictEqual(methodOf.length, 1);
        assert.strictEqual(methodOf(path), 1);
      });
    });

    QUnit.test('should work with deep property values', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': stubTwo } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var methodOf = _.methodOf(object);
        assert.strictEqual(methodOf(path), 2);
      });
    });

    QUnit.test('should work with a non-string `path`', function(assert) {
      assert.expect(2);

      var array = lodashStable.times(3, _.constant);

      lodashStable.each([1, [1]], function(path) {
        var methodOf = _.methodOf(array);
        assert.strictEqual(methodOf(path), 1);
      });
    });

    QUnit.test('should coerce key to a string', function(assert) {
      assert.expect(1);

      function fn() {}
      fn.toString = lodashStable.constant('fn');

      var expected = [1, 1, 2, 2, 3, 3, 4, 4],
          objects = [{ 'null': stubOne }, { 'undefined': stubTwo }, { 'fn': stubThree }, { '[object Object]': stubFour }],
          values = [null, undefined, fn, {}];

      var actual = lodashStable.transform(objects, function(result, object, index) {
        var key = values[index];
        lodashStable.each([key, [key]], function(path) {
          var methodOf = _.methodOf(object);
          result.push(methodOf(key));
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with inherited property values', function(assert) {
      assert.expect(2);

      function Foo() {}
      Foo.prototype.a = stubOne;

      lodashStable.each(['a', ['a']], function(path) {
        var methodOf = _.methodOf(new Foo);
        assert.strictEqual(methodOf(path), 1);
      });
    });

    QUnit.test('should use a key over a path', function(assert) {
      assert.expect(2);

      var object = { 'a.b': stubOne, 'a': { 'b': stubTwo } };

      lodashStable.each(['a.b', ['a.b']], function(path) {
        var methodOf = _.methodOf(object);
        assert.strictEqual(methodOf(path), 1);
      });
    });

    QUnit.test('should return `undefined` when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor', ['constructor']], function(path) {
        var actual = lodashStable.map(values, function(value, index) {
          var methodOf = index ? _.methodOf() : _.methodOf(value);
          return methodOf(path);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` with deep paths when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor.prototype.valueOf', ['constructor', 'prototype', 'valueOf']], function(path) {
        var actual = lodashStable.map(values, function(value, index) {
          var methodOf = index ? _.methodOf() : _.methodOf(value);
          return methodOf(path);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` if parts of `path` are missing', function(assert) {
      assert.expect(4);

      var object = {},
          methodOf = _.methodOf(object);

      lodashStable.each(['a', 'a[1].b.c', ['a'], ['a', '1', 'b', 'c']], function(path) {
        assert.strictEqual(methodOf(path), undefined);
      });
    });

    QUnit.test('should apply partial arguments to function', function(assert) {
      assert.expect(2);

      var object = {
        'fn': function() {
          return slice.call(arguments);
        }
      };

      var methodOf = _.methodOf(object, 1, 2, 3);

      lodashStable.each(['fn', ['fn']], function(path) {
        assert.deepEqual(methodOf(path), [1, 2, 3]);
      });
    });

    QUnit.test('should invoke deep property methods with the correct `this` binding', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': function() { return this.c; }, 'c': 1 } },
          methodOf = _.methodOf(object);

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(methodOf(path), 1);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.min');

  (function() {
    QUnit.test('should return the smallest value from a collection', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.min([1, 2, 3]), 1);
    });

    QUnit.test('should return `undefined` for empty collections', function(assert) {
      assert.expect(1);

      var values = falsey.concat([[]]),
          expected = lodashStable.map(values, noop);

      var actual = lodashStable.map(values, function(value, index) {
        try {
          return index ? _.min(value) : _.min();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with non-numeric collection values', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.min(['a', 'b']), 'a');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('extremum methods');

  lodashStable.each(['max', 'maxBy', 'min', 'minBy'], function(methodName) {
    var func = _[methodName],
        isMax = /^max/.test(methodName);

    QUnit.test('`_.' + methodName + '` should work with Date objects', function(assert) {
      assert.expect(1);

      var curr = new Date,
          past = new Date(0);

      assert.strictEqual(func([curr, past]), isMax ? curr : past);
    });

    QUnit.test('`_.' + methodName + '` should work with extremely large arrays', function(assert) {
      assert.expect(1);

      var array = lodashStable.range(0, 5e5);
      assert.strictEqual(func(array), isMax ? 499999 : 0);
    });

    QUnit.test('`_.' + methodName + '` should work when chaining on an array with only one value', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var actual = _([40])[methodName]();
        assert.strictEqual(actual, 40);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  lodashStable.each(['maxBy', 'minBy'], function(methodName) {
    var array = [1, 2, 3],
        func = _[methodName],
        isMax = methodName == 'maxBy';

    QUnit.test('`_.' + methodName + '` should work with an `iteratee` argument', function(assert) {
      assert.expect(1);

      var actual = func(array, function(n) {
        return -n;
      });

      assert.strictEqual(actual, isMax ? 1 : 3);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var objects = [{ 'a': 2 }, { 'a': 3 }, { 'a': 1 }],
          actual = func(objects, 'a');

      assert.deepEqual(actual, objects[isMax ? 1 : 2]);

      var arrays = [[2], [3], [1]];
      actual = func(arrays, 0);

      assert.deepEqual(actual, arrays[isMax ? 1 : 2]);
    });

    QUnit.test('`_.' + methodName + '` should work when `iteratee` returns +/-Infinity', function(assert) {
      assert.expect(1);

      var value = isMax ? -Infinity : Infinity,
          object = { 'a': value };

      var actual = func([object, { 'a': value }], function(object) {
        return object.a;
      });

      assert.strictEqual(actual, object);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.mixin');

  (function() {
    function reset(wrapper) {
      delete wrapper.a;
      delete wrapper.prototype.a;
      delete wrapper.b;
      delete wrapper.prototype.b;
    }

    function Wrapper(value) {
      if (!(this instanceof Wrapper)) {
        return new Wrapper(value);
      }
      if (_.has(value, '__wrapped__')) {
        var actions = slice.call(value.__actions__),
            chain = value.__chain__;

        value = value.__wrapped__;
      }
      this.__wrapped__ = value;
      this.__actions__ = actions || [];
      this.__chain__ = chain || false;
    }

    Wrapper.prototype.value = function() {
      return getUnwrappedValue(this);
    };

    var array = ['a'],
        source = { 'a': function(array) { return array[0]; }, 'b': 'B' };

    QUnit.test('should mixin `source` methods into lodash', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        _.mixin(source);

        assert.strictEqual(_.a(array), 'a');
        assert.strictEqual(_(array).a().value(), 'a');
        assert.notOk('b' in _);
        assert.notOk('b' in _.prototype);

        reset(_);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should mixin chaining methods by reference', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        _.mixin(source);
        _.a = stubB;

        assert.strictEqual(_.a(array), 'b');
        assert.strictEqual(_(array).a().value(), 'a');

        reset(_);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should use a default `object` of `this`', function(assert) {
      assert.expect(3);

      var object = lodashStable.create(_);
      object.mixin(source);

      assert.strictEqual(object.a(array), 'a');
      assert.notOk('a' in _);
      assert.notOk('a' in _.prototype);

      reset(_);
    });

    QUnit.test('should accept an `object` argument', function(assert) {
      assert.expect(1);

      var object = {};
      _.mixin(object, source);
      assert.strictEqual(object.a(array), 'a');
    });

    QUnit.test('should accept a function `object`', function(assert) {
      assert.expect(2);

      _.mixin(Wrapper, source);

      var wrapped = Wrapper(array),
          actual = wrapped.a();

      assert.strictEqual(actual.value(), 'a');
      assert.ok(actual instanceof Wrapper);

      reset(Wrapper);
    });

    QUnit.test('should return `object`', function(assert) {
      assert.expect(3);

      var object = {};
      assert.strictEqual(_.mixin(object, source), object);
      assert.strictEqual(_.mixin(Wrapper, source), Wrapper);
      assert.strictEqual(_.mixin(), _);

      reset(Wrapper);
    });

    QUnit.test('should not assign inherited `source` methods', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.prototype.a = noop;

      var object = {};
      assert.strictEqual(_.mixin(object, new Foo), object);
    });

    QUnit.test('should accept an `options` argument', function(assert) {
      assert.expect(8);

      function message(func, chain) {
        return (func === _ ? 'lodash' : 'given') + ' function should ' + (chain ? '' : 'not ') + 'chain';
      }

      lodashStable.each([_, Wrapper], function(func) {
        lodashStable.each([{ 'chain': false }, { 'chain': true }], function(options) {
          if (!isNpm) {
            if (func === _) {
              _.mixin(source, options);
            } else {
              _.mixin(func, source, options);
            }
            var wrapped = func(array),
                actual = wrapped.a();

            if (options.chain) {
              assert.strictEqual(actual.value(), 'a', message(func, true));
              assert.ok(actual instanceof func, message(func, true));
            } else {
              assert.strictEqual(actual, 'a', message(func, false));
              assert.notOk(actual instanceof func, message(func, false));
            }
            reset(func);
          }
          else {
            skipAssert(assert, 2);
          }
        });
      });
    });

    QUnit.test('should not extend lodash when an `object` is given with an empty `options` object', function(assert) {
      assert.expect(1);

      _.mixin({ 'a': noop }, {});
      assert.notOk('a' in _);
      reset(_);
    });

    QUnit.test('should not error for non-object `options` values', function(assert) {
      assert.expect(2);

      var pass = true;

      try {
        _.mixin({}, source, 1);
      } catch (e) {
        pass = false;
      }
      assert.ok(pass);

      pass = true;

      try {
        _.mixin(source, 1);
      } catch (e) {
        pass = false;
      }
      assert.ok(pass);

      reset(_);
    });

    QUnit.test('should not return the existing wrapped value when chaining', function(assert) {
      assert.expect(2);

      lodashStable.each([_, Wrapper], function(func) {
        if (!isNpm) {
          if (func === _) {
            var wrapped = _(source),
                actual = wrapped.mixin();

            assert.strictEqual(actual.value(), _);
          }
          else {
            wrapped = _(func);
            actual = wrapped.mixin(source);
            assert.notStrictEqual(actual, wrapped);
          }
          reset(func);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    QUnit.test('should produce methods that work in a lazy sequence', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        _.mixin({ 'a': _.countBy, 'b': _.filter });

        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            actual = _(array).a().map(square).b(isEven).take().value();

        assert.deepEqual(actual, _.take(_.b(_.map(_.a(array), square), isEven)));

        reset(_);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.multiply');

  (function() {
    QUnit.test('should multiply two numbers', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.multiply(6, 4), 24);
      assert.strictEqual(_.multiply(-6, 4), -24);
      assert.strictEqual(_.multiply(-6, -4), 24);
    });

    QUnit.test('should coerce arguments to numbers', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.multiply('6', '4'), 24);
      assert.deepEqual(_.multiply('x', 'y'), NaN);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.orderBy');

  (function() {
    var objects = [
      { 'a': 'x', 'b': 3 },
      { 'a': 'y', 'b': 4 },
      { 'a': 'x', 'b': 1 },
      { 'a': 'y', 'b': 2 }
    ];

    QUnit.test('should sort by a single property by a specified order', function(assert) {
      assert.expect(1);

      var actual = _.orderBy(objects, 'a', 'desc');
      assert.deepEqual(actual, [objects[1], objects[3], objects[0], objects[2]]);
    });

    QUnit.test('should sort by multiple properties by specified orders', function(assert) {
      assert.expect(1);

      var actual = _.orderBy(objects, ['a', 'b'], ['desc', 'asc']);
      assert.deepEqual(actual, [objects[3], objects[1], objects[2], objects[0]]);
    });

    QUnit.test('should sort by a property in ascending order when its order is not specified', function(assert) {
      assert.expect(2);

      var expected = [objects[2], objects[0], objects[3], objects[1]],
          actual = _.orderBy(objects, ['a', 'b']);

      assert.deepEqual(actual, expected);

      expected = lodashStable.map(falsey, lodashStable.constant([objects[3], objects[1], objects[2], objects[0]]));

      actual = lodashStable.map(falsey, function(order, index) {
        return _.orderBy(objects, ['a', 'b'], index ? ['desc', order] : ['desc']);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `orders` specified as string objects', function(assert) {
      assert.expect(1);

      var actual = _.orderBy(objects, ['a'], [Object('desc')]);
      assert.deepEqual(actual, [objects[1], objects[3], objects[0], objects[2]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.overArgs');

  (function() {
    function fn() {
      return slice.call(arguments);
    }

    QUnit.test('should transform each argument', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, doubled, square);
      assert.deepEqual(over(5, 10), [10, 100]);
    });

    QUnit.test('should use `_.identity` when a predicate is nullish', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, undefined, null);
      assert.deepEqual(over('a', 'b'), ['a', 'b']);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, 'b', 'a');
      assert.deepEqual(over({ 'b': 2 }, { 'a': 1 }), [2, 1]);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, { 'b': 1 }, { 'a': 1 });
      assert.deepEqual(over({ 'b': 2 }, { 'a': 1 }), [false, true]);
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, [['b', 1], ['a', 1]]);
      assert.deepEqual(over({ 'b': 2 }, { 'a': 1 }), [false, true]);
    });

    QUnit.test('should differentiate between `_.property` and `_.matchesProperty` shorthands', function(assert) {
      assert.expect(2);

      var over = _.overArgs(fn, ['a', 1]);
      assert.deepEqual(over({ 'a': 1 }, { '1': 2 }), [1, 2]);

      over = _.overArgs(fn, [['a', 1]]);
      assert.deepEqual(over({ 'a': 1 }), [true]);
    });

    QUnit.test('should flatten `transforms`', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, [doubled, square], String);
      assert.deepEqual(over(5, 10, 15), [10, 100, '15']);
    });

    QUnit.test('should not transform any argument greater than the number of transforms', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, doubled, square);
      assert.deepEqual(over(5, 10, 18), [10, 100, 18]);
    });

    QUnit.test('should not transform any arguments if no transforms are given', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn);
      assert.deepEqual(over(5, 10, 18), [5, 10, 18]);
    });

    QUnit.test('should not pass `undefined` if there are more transforms than arguments', function(assert) {
      assert.expect(1);

      var over = _.overArgs(fn, doubled, identity);
      assert.deepEqual(over(5), [10]);
    });

    QUnit.test('should provide the correct argument to each transform', function(assert) {
      assert.expect(1);

      var argsList = [],
          transform = function() { argsList.push(slice.call(arguments)); },
          over = _.overArgs(noop, transform, transform, transform);

      over('a', 'b');
      assert.deepEqual(argsList, [['a'], ['b']]);
    });

    QUnit.test('should use `this` binding of function for `transforms`', function(assert) {
      assert.expect(1);

      var over = _.overArgs(function(x) {
        return this[x];
      }, function(x) {
        return this === x;
      });

      var object = { 'over': over, 'true': 1 };
      assert.strictEqual(object.over(object), 1);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.negate');

  (function() {
    QUnit.test('should create a function that negates the result of `func`', function(assert) {
      assert.expect(2);

      var negate = _.negate(isEven);

      assert.strictEqual(negate(1), true);
      assert.strictEqual(negate(2), false);
    });

    QUnit.test('should create a function that negates the result of `func`', function(assert) {
      assert.expect(2);

      var negate = _.negate(isEven);

      assert.strictEqual(negate(1), true);
      assert.strictEqual(negate(2), false);
    });

    QUnit.test('should create a function that accepts multiple arguments', function(assert) {
      assert.expect(1);

      var argCount,
          count = 4,
          negate = _.negate(function() { argCount = arguments.length; }),
          expected = lodashStable.times(count, stubTrue);

      var actual = lodashStable.times(count, function(index) {
        switch (index) {
          case 0: negate(); break;
          case 1: negate(1); break;
          case 2: negate(1, 2); break;
          case 3: negate(1, 2, 3); break;
          case 4: negate(1, 2, 3, 4);
        }
        return argCount == index;
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.noConflict');

  (function() {
    QUnit.test('should return the `lodash` function', function(assert) {
      assert.expect(2);

      if (!isModularize) {
        assert.strictEqual(_.noConflict(), oldDash);
        assert.notStrictEqual(root._, oldDash);
        root._ = oldDash;
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should restore `_` only if `lodash` is the current `_` value', function(assert) {
      assert.expect(2);

      if (!isModularize) {
        var object = root._ = {};
        assert.strictEqual(_.noConflict(), oldDash);
        assert.strictEqual(root._, object);
        root._ = oldDash;
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should work with a `root` of `this`', function(assert) {
      assert.expect(2);

      if (!coverage && !document && !isModularize && realm.object) {
        var fs = require('fs'),
            vm = require('vm'),
            expected = {},
            context = vm.createContext({ '_': expected, 'console': console }),
            source = fs.readFileSync(filePath, 'utf8');

        vm.runInContext(source + '\nthis.lodash = this._.noConflict()', context);

        assert.strictEqual(context._, expected);
        assert.ok(context.lodash);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.now');

  (function() {
    QUnit.test('should return the number of milliseconds that have elapsed since the Unix epoch', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var stamp = +new Date,
          actual = _.now();

      assert.ok(actual >= stamp);

      setTimeout(function() {
        assert.ok(_.now() > actual);
        done();
      }, 32);
    });

    QUnit.test('should work with mocked `Date.now`', function(assert) {
      assert.expect(1);

      var now = Date.now;
      Date.now = stubA;

      var actual = _.now();
      Date.now = now;

      assert.strictEqual(actual, 'a');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.nth');

  (function() {
    var array = ['a', 'b', 'c', 'd'];

    QUnit.test('should get the nth element of `array`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(array, function(value, index) {
        return _.nth(array, index);
      });

      assert.deepEqual(actual, array);
    });

    QUnit.test('should work with a negative `n`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(lodashStable.range(1, array.length + 1), function(n) {
        return _.nth(array, -n);
      });

      assert.deepEqual(actual, ['d', 'c', 'b', 'a']);
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(2);

      var values = falsey,
          expected = lodashStable.map(values, stubA);

      var actual = lodashStable.map(values, function(n) {
        return n ? _.nth(array, n) : _.nth(array);
      });

      assert.deepEqual(actual, expected);

      values = ['1', 1.6];
      expected = lodashStable.map(values, stubB);

      actual = lodashStable.map(values, function(n) {
        return _.nth(array, n);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `undefined` for empty arrays', function(assert) {
      assert.expect(1);

      var values = [null, undefined, []],
          expected = lodashStable.map(values, noop);

      var actual = lodashStable.map(values, function(array) {
        return _.nth(array, 1);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `undefined` for non-indexes', function(assert) {
      assert.expect(1);

      var array = [1, 2],
          values = [Infinity, array.length],
          expected = lodashStable.map(values, noop);

      array[-1] = 3;

      var actual = lodashStable.map(values, function(n) {
        return _.nth(array, n);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.nthArg');

  (function() {
    var args = ['a', 'b', 'c', 'd'];

    QUnit.test('should create a function that returns its nth argument', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(args, function(value, index) {
        var func = _.nthArg(index);
        return func.apply(undefined, args);
      });

      assert.deepEqual(actual, args);
    });

    QUnit.test('should work with a negative `n`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(lodashStable.range(1, args.length + 1), function(n) {
        var func = _.nthArg(-n);
        return func.apply(undefined, args);
      });

      assert.deepEqual(actual, ['d', 'c', 'b', 'a']);
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(2);

      var values = falsey,
          expected = lodashStable.map(values, stubA);

      var actual = lodashStable.map(values, function(n) {
        var func = n ? _.nthArg(n) : _.nthArg();
        return func.apply(undefined, args);
      });

      assert.deepEqual(actual, expected);

      values = ['1', 1.6];
      expected = lodashStable.map(values, stubB);

      actual = lodashStable.map(values, function(n) {
        var func = _.nthArg(n);
        return func.apply(undefined, args);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `undefined` for empty arrays', function(assert) {
      assert.expect(1);

      var func = _.nthArg(1);
      assert.strictEqual(func(), undefined);
    });

    QUnit.test('should return `undefined` for non-indexes', function(assert) {
      assert.expect(1);

      var values = [Infinity, args.length],
          expected = lodashStable.map(values, noop);

      var actual = lodashStable.map(values, function(n) {
        var func = _.nthArg(n);
        return func.apply(undefined, args);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.omit');

  (function() {
    var args = arguments,
        object = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 };

    QUnit.test('should flatten `props`', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.omit(object, 'a', 'c'), { 'b': 2, 'd': 4 });
      assert.deepEqual(_.omit(object, ['a', 'd'], 'c'), { 'b': 2 });
    });

    QUnit.test('should work with a primitive `object` argument', function(assert) {
      assert.expect(1);

      stringProto.a = 1;
      stringProto.b = 2;

      assert.deepEqual(_.omit('', 'b'), { 'a': 1 });

      delete stringProto.a;
      delete stringProto.b;
    });

    QUnit.test('should return an empty object when `object` is nullish', function(assert) {
      assert.expect(2);

      lodashStable.each([null, undefined], function(value) {
        objectProto.a = 1;
        var actual = _.omit(value, 'valueOf');
        delete objectProto.a;
        assert.deepEqual(actual, {});
      });
    });

    QUnit.test('should work with `arguments` objects as secondary arguments', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.omit(object, args), { 'b': 2, 'd': 4 });
    });

    QUnit.test('should coerce property names to strings', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.omit({ '0': 'a' }, 0), {});
    });
  }('a', 'c'));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.omitBy');

  (function() {
    QUnit.test('should work with a predicate argument', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 };

      var actual = _.omitBy(object, function(n) {
        return n != 2 && n != 4;
      });

      assert.deepEqual(actual, { 'b': 2, 'd': 4 });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('omit methods');

  lodashStable.each(['omit', 'omitBy'], function(methodName) {
    var expected = { 'b': 2, 'd': 4 },
        func = _[methodName],
        object = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 },
        resolve = lodashStable.nthArg(1);

    if (methodName == 'omitBy') {
      resolve = function(object, props) {
        props = lodashStable.castArray(props);
        return function(value) {
          return lodashStable.some(props, function(key) {
            key = lodashStable.isSymbol(key) ? key : lodashStable.toString(key);
            return object[key] === value;
          });
        };
      };
    }
    QUnit.test('`_.' + methodName + '` should create an object with omitted string keyed properties', function(assert) {
      assert.expect(2);

      assert.deepEqual(func(object, resolve(object, 'a')), { 'b': 2, 'c': 3, 'd': 4 });
      assert.deepEqual(func(object, resolve(object, ['a', 'c'])), expected);
    });

    QUnit.test('`_.' + methodName + '` should include inherited string keyed properties', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.prototype = object;

      assert.deepEqual(func(new Foo, resolve(object, ['a', 'c'])), expected);
    });

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object = { '-0': 'a', '0': 'b' },
          props = [-0, Object(-0), 0, Object(0)],
          expected = [{ '0': 'b' }, { '0': 'b' }, { '-0': 'a' }, { '-0': 'a' }];

      var actual = lodashStable.map(props, function(key) {
        return func(object, resolve(object, key));
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should include symbol properties', function(assert) {
      assert.expect(2);

      function Foo() {
        this.a = 0;
        this[symbol] = 1;
      }

      if (Symbol) {
        var symbol2 = Symbol('b');
        Foo.prototype[symbol2] = 2;

        var foo = new Foo,
            actual = func(foo, resolve(foo, 'a'));

        assert.strictEqual(actual[symbol], 1);
        assert.strictEqual(actual[symbol2], 2);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('`_.' + methodName + '` should create an object with omitted symbol properties', function(assert) {
      assert.expect(6);

      function Foo() {
        this.a = 0;
        this[symbol] = 1;
      }

      if (Symbol) {
        var symbol2 = Symbol('b');
        Foo.prototype[symbol2] = 2;

        var foo = new Foo,
            actual = func(foo, resolve(foo, symbol));

        assert.strictEqual(actual.a, 0);
        assert.strictEqual(actual[symbol], undefined);
        assert.strictEqual(actual[symbol2], 2);

        actual = func(foo, resolve(foo, symbol2));

        assert.strictEqual(actual.a, 0);
        assert.strictEqual(actual[symbol], 1);
        assert.strictEqual(actual[symbol2], undefined);
      }
      else {
        skipAssert(assert, 6);
      }
    });

    QUnit.test('`_.' + methodName + '` should work with an array `object` argument', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      assert.deepEqual(func(array, resolve(array, ['0', '2'])), { '1': 2 });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.once');

  (function() {
    QUnit.test('should invoke `func` once', function(assert) {
      assert.expect(2);

      var count = 0,
          once = _.once(function() { return ++count; });

      once();
      assert.strictEqual(once(), 1);
      assert.strictEqual(count, 1);
    });

    QUnit.test('should ignore recursive calls', function(assert) {
      assert.expect(2);

      var count = 0;

      var once = _.once(function() {
        once();
        return ++count;
      });

      assert.strictEqual(once(), 1);
      assert.strictEqual(count, 1);
    });

    QUnit.test('should not throw more than once', function(assert) {
      assert.expect(2);

      var pass = true;

      var once = _.once(function() {
        throw new Error;
      });

      assert.raises(once);

      try {
        once();
      } catch (e) {
        pass = false;
      }
      assert.ok(pass);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.over');

  (function() {
    QUnit.test('should create a function that invokes `iteratees`', function(assert) {
      assert.expect(1);

      var over = _.over(Math.max, Math.min);
      assert.deepEqual(over(1, 2, 3, 4), [4, 1]);
    });

    QUnit.test('should use `_.identity` when a predicate is nullish', function(assert) {
      assert.expect(1);

      var over = _.over(undefined, null);
      assert.deepEqual(over('a', 'b', 'c'), ['a', 'a']);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var over = _.over('b', 'a');
      assert.deepEqual(over({ 'a': 1, 'b': 2 }), [2, 1]);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      var over = _.over({ 'b': 1 }, { 'a': 1 });
      assert.deepEqual(over({ 'a': 1, 'b': 2 }), [false, true]);
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(2);

      var over = _.over([['b', 2], ['a', 2]]);

      assert.deepEqual(over({ 'a': 1, 'b': 2 }), [true, false]);
      assert.deepEqual(over({ 'a': 2, 'b': 1 }), [false, true]);
    });

    QUnit.test('should differentiate between `_.property` and `_.matchesProperty` shorthands', function(assert) {
      assert.expect(4);

      var over = _.over(['a', 1]);

      assert.deepEqual(over({ 'a': 1, '1': 2 }), [1, 2]);
      assert.deepEqual(over({ 'a': 2, '1': 1 }), [2, 1]);

      over = _.over([['a', 1]]);

      assert.deepEqual(over({ 'a': 1 }), [true]);
      assert.deepEqual(over({ 'a': 2 }), [false]);
    });

    QUnit.test('should provide arguments to predicates', function(assert) {
      assert.expect(1);

      var over = _.over(function() {
        return slice.call(arguments);
      });

      assert.deepEqual(over('a', 'b', 'c'), [['a', 'b', 'c']]);
    });

    QUnit.test('should use `this` binding of function for `iteratees`', function(assert) {
      assert.expect(1);

      var over = _.over(function() { return this.b; }, function() { return this.a; }),
          object = { 'over': over, 'a': 1, 'b': 2 };

      assert.deepEqual(object.over(), [2, 1]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.overEvery');

  (function() {
    QUnit.test('should create a function that returns `true` if all predicates return truthy', function(assert) {
      assert.expect(1);

      var over = _.overEvery(stubTrue, stubOne, stubA);
      assert.strictEqual(over(), true);
    });

    QUnit.test('should return `false` as soon as a predicate returns falsey', function(assert) {
      assert.expect(2);

      var count = 0,
          countFalse = function() { count++; return false; },
          countTrue = function() { count++; return true; },
          over = _.overEvery(countTrue, countFalse, countTrue);

      assert.strictEqual(over(), false);
      assert.strictEqual(count, 2);
    });

    QUnit.test('should use `_.identity` when a predicate is nullish', function(assert) {
      assert.expect(2);

      var over = _.overEvery(undefined, null);

      assert.strictEqual(over(true), true);
      assert.strictEqual(over(false), false);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var over = _.overEvery('b', 'a');

      assert.strictEqual(over({ 'a': 1, 'b': 1 }), true);
      assert.strictEqual(over({ 'a': 0, 'b': 1 }), false);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(2);

      var over = _.overEvery({ 'b': 2 }, { 'a': 1 });

      assert.strictEqual(over({ 'a': 1, 'b': 2 }), true);
      assert.strictEqual(over({ 'a': 0, 'b': 2 }), false);
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(2);

      var over = _.overEvery([['b', 2], ['a', 1]]);

      assert.strictEqual(over({ 'a': 1, 'b': 2 }), true);
      assert.strictEqual(over({ 'a': 0, 'b': 2 }), false);
    });

    QUnit.test('should differentiate between `_.property` and `_.matchesProperty` shorthands', function(assert) {
      assert.expect(5);

      var over = _.overEvery(['a', 1]);

      assert.strictEqual(over({ 'a': 1, '1': 1 }), true);
      assert.strictEqual(over({ 'a': 1, '1': 0 }), false);
      assert.strictEqual(over({ 'a': 0, '1': 1 }), false);

      over = _.overEvery([['a', 1]]);

      assert.strictEqual(over({ 'a': 1 }), true);
      assert.strictEqual(over({ 'a': 2 }), false);
    });

    QUnit.test('should flatten `predicates`', function(assert) {
      assert.expect(1);

      var over = _.overEvery(stubTrue, [stubFalse]);
      assert.strictEqual(over(), false);
    });

    QUnit.test('should provide arguments to predicates', function(assert) {
      assert.expect(1);

      var args;

      var over = _.overEvery(function() {
        args = slice.call(arguments);
      });

      over('a', 'b', 'c');
      assert.deepEqual(args, ['a', 'b', 'c']);
    });

    QUnit.test('should use `this` binding of function for `predicates`', function(assert) {
      assert.expect(2);

      var over = _.overEvery(function() { return this.b; }, function() { return this.a; }),
          object = { 'over': over, 'a': 1, 'b': 2 };

      assert.strictEqual(object.over(), true);

      object.a = 0;
      assert.strictEqual(object.over(), false);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.overSome');

  (function() {
    QUnit.test('should create a function that returns `true` if any predicates return truthy', function(assert) {
      assert.expect(2);

      var over = _.overSome(stubFalse, stubOne, stubString);
      assert.strictEqual(over(), true);

      over = _.overSome(stubNull, stubA, stubZero);
      assert.strictEqual(over(), true);
    });

    QUnit.test('should return `true` as soon as `predicate` returns truthy', function(assert) {
      assert.expect(2);

      var count = 0,
          countFalse = function() { count++; return false; },
          countTrue = function() { count++; return true; },
          over = _.overSome(countFalse, countTrue, countFalse);

      assert.strictEqual(over(), true);
      assert.strictEqual(count, 2);
    });

    QUnit.test('should return `false` if all predicates return falsey', function(assert) {
      assert.expect(2);

      var over = _.overSome(stubFalse, stubFalse, stubFalse);
      assert.strictEqual(over(), false);

      over = _.overSome(stubNull, stubZero, stubString);
      assert.strictEqual(over(), false);
    });

    QUnit.test('should use `_.identity` when a predicate is nullish', function(assert) {
      assert.expect(2);

      var over = _.overSome(undefined, null);

      assert.strictEqual(over(true), true);
      assert.strictEqual(over(false), false);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var over = _.overSome('b', 'a');

      assert.strictEqual(over({ 'a': 1, 'b': 0 }), true);
      assert.strictEqual(over({ 'a': 0, 'b': 0 }), false);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(2);

      var over = _.overSome({ 'b': 2 }, { 'a': 1 });

      assert.strictEqual(over({ 'a': 0, 'b': 2 }), true);
      assert.strictEqual(over({ 'a': 0, 'b': 0 }), false);
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(2);

      var over = _.overSome([['b', 2], ['a', 1]]);

      assert.strictEqual(over({ 'a': 0, 'b': 2 }), true);
      assert.strictEqual(over({ 'a': 0, 'b': 0 }), false);
    });

    QUnit.test('should differentiate between `_.property` and `_.matchesProperty` shorthands', function(assert) {
      assert.expect(5);

      var over = _.overSome(['a', 1]);

      assert.strictEqual(over({ 'a': 0, '1': 0 }), false);
      assert.strictEqual(over({ 'a': 1, '1': 0 }), true);
      assert.strictEqual(over({ 'a': 0, '1': 1 }), true);

      over = _.overSome([['a', 1]]);

      assert.strictEqual(over({ 'a': 1 }), true);
      assert.strictEqual(over({ 'a': 2 }), false);
    });

    QUnit.test('should flatten `predicates`', function(assert) {
      assert.expect(1);

      var over = _.overSome(stubFalse, [stubTrue]);
      assert.strictEqual(over(), true);
    });

    QUnit.test('should provide arguments to predicates', function(assert) {
      assert.expect(1);

      var args;

      var over = _.overSome(function() {
        args = slice.call(arguments);
      });

      over('a', 'b', 'c');
      assert.deepEqual(args, ['a', 'b', 'c']);
    });

    QUnit.test('should use `this` binding of function for `predicates`', function(assert) {
      assert.expect(2);

      var over = _.overSome(function() { return this.b; }, function() { return this.a; }),
          object = { 'over': over, 'a': 1, 'b': 2 };

      assert.strictEqual(object.over(), true);

      object.a = object.b = 0;
      assert.strictEqual(object.over(), false);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.pad');

  (function() {
    var string = 'abc';

    QUnit.test('should pad a string to a given length', function(assert) {
      assert.expect(1);

      var values = [, undefined],
          expected = lodashStable.map(values, lodashStable.constant(' abc  '));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.pad(string, 6, value) : _.pad(string, 6);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should truncate pad characters to fit the pad length', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.pad(string, 8), '  abc   ');
      assert.strictEqual(_.pad(string, 8, '_-'), '_-abc_-_');
    });

    QUnit.test('should coerce `string` to a string', function(assert) {
      assert.expect(1);

      var values = [Object(string), { 'toString': lodashStable.constant(string) }],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        return _.pad(value, 6) === ' abc  ';
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.padEnd');

  (function() {
    var string = 'abc';

    QUnit.test('should pad a string to a given length', function(assert) {
      assert.expect(1);

      var values = [, undefined],
          expected = lodashStable.map(values, lodashStable.constant('abc   '));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.padEnd(string, 6, value) : _.padEnd(string, 6);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should truncate pad characters to fit the pad length', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.padEnd(string, 6, '_-'), 'abc_-_');
    });

    QUnit.test('should coerce `string` to a string', function(assert) {
      assert.expect(1);

      var values = [Object(string), { 'toString': lodashStable.constant(string) }],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        return _.padEnd(value, 6) === 'abc   ';
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.padStart');

  (function() {
    var string = 'abc';

    QUnit.test('should pad a string to a given length', function(assert) {
      assert.expect(1);

      var values = [, undefined],
          expected = lodashStable.map(values, lodashStable.constant('   abc'));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.padStart(string, 6, value) : _.padStart(string, 6);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should truncate pad characters to fit the pad length', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.padStart(string, 6, '_-'), '_-_abc');
    });

    QUnit.test('should coerce `string` to a string', function(assert) {
      assert.expect(1);

      var values = [Object(string), { 'toString': lodashStable.constant(string) }],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        return _.padStart(value, 6) === '   abc';
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('pad methods');

  lodashStable.each(['pad', 'padStart', 'padEnd'], function(methodName) {
    var func = _[methodName],
        isPad = methodName == 'pad',
        isStart = methodName == 'padStart',
        string = 'abc';

    QUnit.test('`_.' + methodName + '` should not pad if string is >= `length`', function(assert) {
      assert.expect(2);

      assert.strictEqual(func(string, 2), string);
      assert.strictEqual(func(string, 3), string);
    });

    QUnit.test('`_.' + methodName + '` should treat negative `length` as `0`', function(assert) {
      assert.expect(2);

      lodashStable.each([0, -2], function(length) {
        assert.strictEqual(func(string, length), string);
      });
    });

    QUnit.test('`_.' + methodName + '` should coerce `length` to a number', function(assert) {
      assert.expect(2);

      lodashStable.each(['', '4'], function(length) {
        var actual = length ? (isStart ? ' abc' : 'abc ') : string;
        assert.strictEqual(func(string, length), actual);
      });
    });

    QUnit.test('`_.' + methodName + '` should treat nullish values as empty strings', function(assert) {
      assert.expect(6);

      lodashStable.each([undefined, '_-'], function(chars) {
        var expected = chars ? (isPad ? '__' : chars) : '  ';
        assert.strictEqual(func(null, 2, chars), expected);
        assert.strictEqual(func(undefined, 2, chars), expected);
        assert.strictEqual(func('', 2, chars), expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `string` when `chars` coerces to an empty string', function(assert) {
      assert.expect(1);

      var values = ['', Object('')],
          expected = lodashStable.map(values, lodashStable.constant(string));

      var actual = lodashStable.map(values, function(value) {
        return _.pad(string, 6, value);
      });

      assert.deepEqual(actual, expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.parseInt');

  (function() {
    QUnit.test('should accept a `radix` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.range(2, 37);

      var actual = lodashStable.map(expected, function(radix) {
        return _.parseInt('10', radix);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should use a radix of `10`, for non-hexadecimals, if `radix` is `undefined` or `0`', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.parseInt('10'), 10);
      assert.strictEqual(_.parseInt('10', 0), 10);
      assert.strictEqual(_.parseInt('10', 10), 10);
      assert.strictEqual(_.parseInt('10', undefined), 10);
    });

    QUnit.test('should use a radix of `16`, for hexadecimals, if `radix` is `undefined` or `0`', function(assert) {
      assert.expect(8);

      lodashStable.each(['0x20', '0X20'], function(string) {
        assert.strictEqual(_.parseInt(string), 32);
        assert.strictEqual(_.parseInt(string, 0), 32);
        assert.strictEqual(_.parseInt(string, 16), 32);
        assert.strictEqual(_.parseInt(string, undefined), 32);
      });
    });

    QUnit.test('should use a radix of `10` for string with leading zeros', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.parseInt('08'), 8);
      assert.strictEqual(_.parseInt('08', 10), 8);
    });

    QUnit.test('should parse strings with leading whitespace (test in Chrome and Firefox)', function(assert) {
      assert.expect(2);

      var expected = [8, 8, 10, 10, 32, 32, 32, 32];

      lodashStable.times(2, function(index) {
        var actual = [],
            func = (index ? (lodashBizarro || {}) : _).parseInt;

        if (func) {
          lodashStable.times(2, function(otherIndex) {
            var string = otherIndex ? '10' : '08';
            actual.push(
              func(whitespace + string, 10),
              func(whitespace + string)
            );
          });

          lodashStable.each(['0x20', '0X20'], function(string) {
            actual.push(
              func(whitespace + string),
              func(whitespace + string, 16)
            );
          });

          assert.deepEqual(actual, expected);
        }
        else {
          skipAssert(assert);
        }
      });
    });

    QUnit.test('should coerce `radix` to a number', function(assert) {
      assert.expect(2);

      var object = { 'valueOf': stubZero };
      assert.strictEqual(_.parseInt('08', object), 8);
      assert.strictEqual(_.parseInt('0x20', object), 32);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(2);

      var strings = lodashStable.map(['6', '08', '10'], Object),
          actual = lodashStable.map(strings, _.parseInt);

      assert.deepEqual(actual, [6, 8, 10]);

      actual = lodashStable.map('123', _.parseInt);
      assert.deepEqual(actual, [1, 2, 3]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('partial methods');

  lodashStable.each(['partial', 'partialRight'], function(methodName) {
    var func = _[methodName],
        isPartial = methodName == 'partial',
        ph = func.placeholder;

    QUnit.test('`_.' + methodName + '` partially applies arguments', function(assert) {
      assert.expect(1);

      var par = func(identity, 'a');
      assert.strictEqual(par(), 'a');
    });

    QUnit.test('`_.' + methodName + '` creates a function that can be invoked with additional arguments', function(assert) {
      assert.expect(1);

      var fn = function(a, b) { return [a, b]; },
          par = func(fn, 'a'),
          expected = isPartial ? ['a', 'b'] : ['b', 'a'];

      assert.deepEqual(par('b'), expected);
    });

    QUnit.test('`_.' + methodName + '` works when there are no partially applied arguments and the created function is invoked without additional arguments', function(assert) {
      assert.expect(1);

      var fn = function() { return arguments.length; },
          par = func(fn);

      assert.strictEqual(par(), 0);
    });

    QUnit.test('`_.' + methodName + '` works when there are no partially applied arguments and the created function is invoked with additional arguments', function(assert) {
      assert.expect(1);

      var par = func(identity);
      assert.strictEqual(par('a'), 'a');
    });

    QUnit.test('`_.' + methodName + '` should support placeholders', function(assert) {
      assert.expect(4);

      var fn = function() { return slice.call(arguments); },
          par = func(fn, ph, 'b', ph);

      assert.deepEqual(par('a', 'c'), ['a', 'b', 'c']);
      assert.deepEqual(par('a'), ['a', 'b', undefined]);
      assert.deepEqual(par(), [undefined, 'b', undefined]);

      if (isPartial) {
        assert.deepEqual(par('a', 'c', 'd'), ['a', 'b', 'c', 'd']);
      } else {
        par = func(fn, ph, 'c', ph);
        assert.deepEqual(par('a', 'b', 'd'), ['a', 'b', 'c', 'd']);
      }
    });

    QUnit.test('`_.' + methodName + '` should use `_.placeholder` when set', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var _ph = _.placeholder = {},
            fn = function() { return slice.call(arguments); },
            par = func(fn, _ph, 'b', ph),
            expected = isPartial ? ['a', 'b', ph, 'c'] : ['a', 'c', 'b', ph];

        assert.deepEqual(par('a', 'c'), expected);
        delete _.placeholder;
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` creates a function with a `length` of `0`', function(assert) {
      assert.expect(1);

      var fn = function(a, b, c) {},
          par = func(fn, 'a');

      assert.strictEqual(par.length, 0);
    });

    QUnit.test('`_.' + methodName + '` should ensure `new par` is an instance of `func`', function(assert) {
      assert.expect(2);

      function Foo(value) {
        return value && object;
      }

      var object = {},
          par = func(Foo);

      assert.ok(new par instanceof Foo);
      assert.strictEqual(new par(true), object);
    });

    QUnit.test('`_.' + methodName + '` should clone metadata for created functions', function(assert) {
      assert.expect(3);

      function greet(greeting, name) {
        return greeting + ' ' + name;
      }

      var par1 = func(greet, 'hi'),
          par2 = func(par1, 'barney'),
          par3 = func(par1, 'pebbles');

      assert.strictEqual(par1('fred'), isPartial ? 'hi fred' : 'fred hi');
      assert.strictEqual(par2(), isPartial ? 'hi barney'  : 'barney hi');
      assert.strictEqual(par3(), isPartial ? 'hi pebbles' : 'pebbles hi');
    });

    QUnit.test('`_.' + methodName + '` should work with curried functions', function(assert) {
      assert.expect(2);

      var fn = function(a, b, c) { return a + b + c; },
          curried = _.curry(func(fn, 1), 2);

      assert.strictEqual(curried(2, 3), 6);
      assert.strictEqual(curried(2)(3), 6);
    });

    QUnit.test('should work with placeholders and curried functions', function(assert) {
      assert.expect(1);

      var fn = function() { return slice.call(arguments); },
          curried = _.curry(fn),
          par = func(curried, ph, 'b', ph, 'd');

      assert.deepEqual(par('a', 'c'), ['a', 'b', 'c', 'd']);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.partialRight');

  (function() {
    QUnit.test('should work as a deep `_.defaults`', function(assert) {
      assert.expect(1);

      var object = { 'a': { 'b': 2 } },
          source = { 'a': { 'b': 3, 'c': 3 } },
          expected = { 'a': { 'b': 2, 'c': 3 } };

      var defaultsDeep = _.partialRight(_.mergeWith, function deep(value, other) {
        return lodashStable.isObject(value) ? _.mergeWith(value, other, deep) : value;
      });

      assert.deepEqual(defaultsDeep(object, source), expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('methods using `createWrapper`');

  (function() {
    function fn() {
      return slice.call(arguments);
    }

    var ph1 = _.bind.placeholder,
        ph2 = _.bindKey.placeholder,
        ph3 = _.partial.placeholder,
        ph4 = _.partialRight.placeholder;

    QUnit.test('should work with combinations of partial functions', function(assert) {
      assert.expect(1);

      var a = _.partial(fn),
          b = _.partialRight(a, 3),
          c = _.partial(b, 1);

      assert.deepEqual(c(2), [1, 2, 3]);
    });

    QUnit.test('should work with combinations of bound and partial functions', function(assert) {
      assert.expect(3);

      var fn = function() {
        var result = [this.a];
        push.apply(result, arguments);
        return result;
      };

      var expected = [1, 2, 3, 4],
          object = { 'a': 1, 'fn': fn };

      var a = _.bindKey(object, 'fn'),
          b = _.partialRight(a, 4),
          c = _.partial(b, 2);

      assert.deepEqual(c(3), expected);

      a = _.bind(fn, object);
      b = _.partialRight(a, 4);
      c = _.partial(b, 2);

      assert.deepEqual(c(3), expected);

      a = _.partial(fn, 2);
      b = _.bind(a, object);
      c = _.partialRight(b, 4);

      assert.deepEqual(c(3), expected);
    });

    QUnit.test('should ensure `new combo` is an instance of `func`', function(assert) {
      assert.expect(2);

      function Foo(a, b, c) {
        return b === 0 && object;
      }

      var combo = _.partial(_.partialRight(Foo, 3), 1),
          object = {};

      assert.ok(new combo(2) instanceof Foo);
      assert.strictEqual(new combo(0), object);
    });

    QUnit.test('should work with combinations of functions with placeholders', function(assert) {
      assert.expect(3);

      var expected = [1, 2, 3, 4, 5, 6],
          object = { 'fn': fn };

      var a = _.bindKey(object, 'fn', ph2, 2),
          b = _.partialRight(a, ph4, 6),
          c = _.partial(b, 1, ph3, 4);

      assert.deepEqual(c(3, 5), expected);

      a = _.bind(fn, object, ph1, 2);
      b = _.partialRight(a, ph4, 6);
      c = _.partial(b, 1, ph3, 4);

      assert.deepEqual(c(3, 5), expected);

      a = _.partial(fn, ph3, 2);
      b = _.bind(a, object, 1, ph1, 4);
      c = _.partialRight(b, ph4, 6);

      assert.deepEqual(c(3, 5), expected);
    });

    QUnit.test('should work with combinations of functions with overlapping placeholders', function(assert) {
      assert.expect(3);

      var expected = [1, 2, 3, 4],
          object = { 'fn': fn };

      var a = _.bindKey(object, 'fn', ph2, 2),
          b = _.partialRight(a, ph4, 4),
          c = _.partial(b, ph3, 3);

      assert.deepEqual(c(1), expected);

      a = _.bind(fn, object, ph1, 2);
      b = _.partialRight(a, ph4, 4);
      c = _.partial(b, ph3, 3);

      assert.deepEqual(c(1), expected);

      a = _.partial(fn, ph3, 2);
      b = _.bind(a, object, ph1, 3);
      c = _.partialRight(b, ph4, 4);

      assert.deepEqual(c(1), expected);
    });

    QUnit.test('should work with recursively bound functions', function(assert) {
      assert.expect(1);

      var fn = function() {
        return this.a;
      };

      var a = _.bind(fn, { 'a': 1 }),
          b = _.bind(a,  { 'a': 2 }),
          c = _.bind(b,  { 'a': 3 });

      assert.strictEqual(c(), 1);
    });

    QUnit.test('should work when hot', function(assert) {
      assert.expect(12);

      lodashStable.times(2, function(index) {
        var fn = function() {
          var result = [this];
          push.apply(result, arguments);
          return result;
        };

        var object = {},
            bound1 = index ? _.bind(fn, object, 1) : _.bind(fn, object),
            expected = [object, 1, 2, 3];

        var actual = _.last(lodashStable.times(HOT_COUNT, function() {
          var bound2 = index ? _.bind(bound1, null, 2) : _.bind(bound1);
          return index ? bound2(3) : bound2(1, 2, 3);
        }));

        assert.deepEqual(actual, expected);

        actual = _.last(lodashStable.times(HOT_COUNT, function() {
          var bound1 = index ? _.bind(fn, object, 1) : _.bind(fn, object),
              bound2 = index ? _.bind(bound1, null, 2) : _.bind(bound1);

          return index ? bound2(3) : bound2(1, 2, 3);
        }));

        assert.deepEqual(actual, expected);
      });

      lodashStable.each(['curry', 'curryRight'], function(methodName, index) {
        var fn = function(a, b, c) { return [a, b, c]; },
            curried = _[methodName](fn),
            expected = index ? [3, 2, 1] :  [1, 2, 3];

        var actual = _.last(lodashStable.times(HOT_COUNT, function() {
          return curried(1)(2)(3);
        }));

        assert.deepEqual(actual, expected);

        actual = _.last(lodashStable.times(HOT_COUNT, function() {
          var curried = _[methodName](fn);
          return curried(1)(2)(3);
        }));

        assert.deepEqual(actual, expected);
      });

      lodashStable.each(['partial', 'partialRight'], function(methodName, index) {
        var func = _[methodName],
            fn = function() { return slice.call(arguments); },
            par1 = func(fn, 1),
            expected = index ? [3, 2, 1] : [1, 2, 3];

        var actual = _.last(lodashStable.times(HOT_COUNT, function() {
          var par2 = func(par1, 2);
          return par2(3);
        }));

        assert.deepEqual(actual, expected);

        actual = _.last(lodashStable.times(HOT_COUNT, function() {
          var par1 = func(fn, 1),
              par2 = func(par1, 2);

          return par2(3);
        }));

        assert.deepEqual(actual, expected);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.partition');

  (function() {
    var array = [1, 0, 1];

    QUnit.test('should split elements into two groups by `predicate`', function(assert) {
      assert.expect(3);

      assert.deepEqual(_.partition([], identity), [[], []]);
      assert.deepEqual(_.partition(array, stubTrue), [array, []]);
      assert.deepEqual(_.partition(array, stubFalse), [[], array]);
    });

    QUnit.test('should use `_.identity` when `predicate` is nullish', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([[1, 1], [0]]));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.partition(array, value) : _.partition(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': 1 }, { 'a': 1 }, { 'b': 2 }],
          actual = _.partition(objects, 'a');

      assert.deepEqual(actual, [objects.slice(0, 2), objects.slice(2)]);
    });

    QUnit.test('should work with a number for `predicate`', function(assert) {
      assert.expect(2);

      var array = [
        [1, 0],
        [0, 1],
        [1, 0]
      ];

      assert.deepEqual(_.partition(array, 0), [[array[0], array[2]], [array[1]]]);
      assert.deepEqual(_.partition(array, 1), [[array[1]], [array[0], array[2]]]);
    });

    QUnit.test('should work with an object for `collection`', function(assert) {
      assert.expect(1);

      var actual = _.partition({ 'a': 1.1, 'b': 0.2, 'c': 1.3 }, Math.floor);
      assert.deepEqual(actual, [[1.1, 1.3], [0.2]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.pick');

  (function() {
    var args = arguments,
        object = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 };

    QUnit.test('should flatten `props`', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.pick(object, 'a', 'c'), { 'a': 1, 'c': 3 });
      assert.deepEqual(_.pick(object, ['a', 'd'], 'c'), { 'a': 1, 'c': 3, 'd': 4 });
    });

    QUnit.test('should work with a primitive `object` argument', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.pick('', 'slice'), { 'slice': ''.slice });
    });

    QUnit.test('should return an empty object when `object` is nullish', function(assert) {
      assert.expect(2);

      lodashStable.each([null, undefined], function(value) {
        assert.deepEqual(_.pick(value, 'valueOf'), {});
      });
    });

    QUnit.test('should work with `arguments` objects as secondary arguments', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.pick(object, args), { 'a': 1, 'c': 3 });
    });

    QUnit.test('should coerce property names to strings', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.pick({ '0': 'a', '1': 'b' }, 0), { '0': 'a' });
    });
  }('a', 'c'));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.pickBy');

  (function() {
    QUnit.test('should work with a predicate argument', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 };

      var actual = _.pickBy(object, function(n) {
        return n == 1 || n == 3;
      });

      assert.deepEqual(actual, { 'a': 1, 'c': 3 });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('pick methods');

  lodashStable.each(['pick', 'pickBy'], function(methodName) {
    var expected = { 'a': 1, 'c': 3 },
        func = _[methodName],
        object = { 'a': 1, 'b': 2, 'c': 3, 'd': 4 },
        resolve = lodashStable.nthArg(1);

    if (methodName == 'pickBy') {
      resolve = function(object, props) {
        props = lodashStable.castArray(props);
        return function(value) {
          return lodashStable.some(props, function(key) {
            key = lodashStable.isSymbol(key) ? key : lodashStable.toString(key);
            return object[key] === value;
          });
        };
      };
    }
    QUnit.test('`_.' + methodName + '` should create an object of picked string keyed properties', function(assert) {
      assert.expect(2);

      assert.deepEqual(func(object, resolve(object, 'a')), { 'a': 1 });
      assert.deepEqual(func(object, resolve(object, ['a', 'c'])), expected);
    });

    QUnit.test('`_.' + methodName + '` should pick inherited string keyed properties', function(assert) {
      assert.expect(1);

      function Foo() {}
      Foo.prototype = object;

      var foo = new Foo;
      assert.deepEqual(func(foo, resolve(foo, ['a', 'c'])), expected);
    });

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object = { '-0': 'a', '0': 'b' },
          props = [-0, Object(-0), 0, Object(0)],
          expected = [{ '-0': 'a' }, { '-0': 'a' }, { '0': 'b' }, { '0': 'b' }];

      var actual = lodashStable.map(props, function(key) {
        return func(object, resolve(object, key));
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should pick symbol properties', function(assert) {
      assert.expect(2);

      function Foo() {
        this[symbol] = 1;
      }

      if (Symbol) {
        var symbol2 = Symbol('b');
        Foo.prototype[symbol2] = 2;

        var foo = new Foo,
            actual = func(foo, resolve(foo, [symbol, symbol2]));

        assert.strictEqual(actual[symbol], 1);
        assert.strictEqual(actual[symbol2], 2);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('`_.' + methodName + '` should work with an array `object` argument', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      assert.deepEqual(func(array, resolve(array, '1')), { '1': 2 });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.property');

  (function() {
    QUnit.test('should create a function that plucks a property value of a given object', function(assert) {
      assert.expect(4);

      var object = { 'a': 1 };

      lodashStable.each(['a', ['a']], function(path) {
        var prop = _.property(path);
        assert.strictEqual(prop.length, 1);
        assert.strictEqual(prop(object), 1);
      });
    });

    QUnit.test('should pluck deep property values', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': 2 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var prop = _.property(path);
        assert.strictEqual(prop(object), 2);
      });
    });

    QUnit.test('should pluck inherited property values', function(assert) {
      assert.expect(2);

      function Foo() {}
      Foo.prototype.a = 1;

      lodashStable.each(['a', ['a']], function(path) {
        var prop = _.property(path);
        assert.strictEqual(prop(new Foo), 1);
      });
    });

    QUnit.test('should work with a non-string `path`', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3];

      lodashStable.each([1, [1]], function(path) {
        var prop = _.property(path);
        assert.strictEqual(prop(array), 2);
      });
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object = { '-0': 'a', '0': 'b' },
          props = [-0, Object(-0), 0, Object(0)];

      var actual = lodashStable.map(props, function(key) {
        var prop = _.property(key);
        return prop(object);
      });

      assert.deepEqual(actual, ['a', 'a', 'b', 'b']);
    });

    QUnit.test('should coerce key to a string', function(assert) {
      assert.expect(1);

      function fn() {}
      fn.toString = lodashStable.constant('fn');

      var objects = [{ 'null': 1 }, { 'undefined': 2 }, { 'fn': 3 }, { '[object Object]': 4 }],
          values = [null, undefined, fn, {}];

      var actual = lodashStable.transform(objects, function(result, object, index) {
        var key = values[index];
        lodashStable.each([key, [key]], function(path) {
          var prop = _.property(key);
          result.push(prop(object));
        });
      });

      assert.deepEqual(actual, [1, 1, 2, 2, 3, 3, 4, 4]);
    });

    QUnit.test('should pluck a key over a path', function(assert) {
      assert.expect(2);

      var object = { 'a.b': 1, 'a': { 'b': 2 } };

      lodashStable.each(['a.b', ['a.b']], function(path) {
        var prop = _.property(path);
        assert.strictEqual(prop(object), 1);
      });
    });

    QUnit.test('should return `undefined` when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor', ['constructor']], function(path) {
        var prop = _.property(path);

        var actual = lodashStable.map(values, function(value, index) {
          return index ? prop(value) : prop();
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` with deep paths when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor.prototype.valueOf', ['constructor', 'prototype', 'valueOf']], function(path) {
        var prop = _.property(path);

        var actual = lodashStable.map(values, function(value, index) {
          return index ? prop(value) : prop();
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` if parts of `path` are missing', function(assert) {
      assert.expect(4);

      var object = {};

      lodashStable.each(['a', 'a[1].b.c', ['a'], ['a', '1', 'b', 'c']], function(path) {
        var prop = _.property(path);
        assert.strictEqual(prop(object), undefined);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.propertyOf');

  (function() {
    QUnit.test('should create a function that plucks a property value of a given key', function(assert) {
      assert.expect(3);

      var object = { 'a': 1 },
          propOf = _.propertyOf(object);

      assert.strictEqual(propOf.length, 1);
      lodashStable.each(['a', ['a']], function(path) {
        assert.strictEqual(propOf(path), 1);
      });
    });

    QUnit.test('should pluck deep property values', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': 2 } },
          propOf = _.propertyOf(object);

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(propOf(path), 2);
      });
    });

    QUnit.test('should pluck inherited property values', function(assert) {
      assert.expect(2);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var propOf = _.propertyOf(new Foo);

      lodashStable.each(['b', ['b']], function(path) {
        assert.strictEqual(propOf(path), 2);
      });
    });

    QUnit.test('should work with a non-string `path`', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3],
          propOf = _.propertyOf(array);

      lodashStable.each([1, [1]], function(path) {
        assert.strictEqual(propOf(path), 2);
      });
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object = { '-0': 'a', '0': 'b' },
          props = [-0, Object(-0), 0, Object(0)];

      var actual = lodashStable.map(props, function(key) {
        var propOf = _.propertyOf(object);
        return propOf(key);
      });

      assert.deepEqual(actual, ['a', 'a', 'b', 'b']);
    });

    QUnit.test('should coerce key to a string', function(assert) {
      assert.expect(1);

      function fn() {}
      fn.toString = lodashStable.constant('fn');

      var objects = [{ 'null': 1 }, { 'undefined': 2 }, { 'fn': 3 }, { '[object Object]': 4 }],
          values = [null, undefined, fn, {}];

      var actual = lodashStable.transform(objects, function(result, object, index) {
        var key = values[index];
        lodashStable.each([key, [key]], function(path) {
          var propOf = _.propertyOf(object);
          result.push(propOf(key));
        });
      });

      assert.deepEqual(actual, [1, 1, 2, 2, 3, 3, 4, 4]);
    });

    QUnit.test('should pluck a key over a path', function(assert) {
      assert.expect(2);

      var object = { 'a.b': 1, 'a': { 'b': 2 } },
          propOf = _.propertyOf(object);

      lodashStable.each(['a.b', ['a.b']], function(path) {
        assert.strictEqual(propOf(path), 1);
      });
    });

    QUnit.test('should return `undefined` when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor', ['constructor']], function(path) {
        var actual = lodashStable.map(values, function(value, index) {
          var propOf = index ? _.propertyOf(value) : _.propertyOf();
          return propOf(path);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` with deep paths when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, noop);

      lodashStable.each(['constructor.prototype.valueOf', ['constructor', 'prototype', 'valueOf']], function(path) {
        var actual = lodashStable.map(values, function(value, index) {
          var propOf = index ? _.propertyOf(value) : _.propertyOf();
          return propOf(path);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should return `undefined` if parts of `path` are missing', function(assert) {
      assert.expect(4);

      var propOf = _.propertyOf({});

      lodashStable.each(['a', 'a[1].b.c', ['a'], ['a', '1', 'b', 'c']], function(path) {
        assert.strictEqual(propOf(path), undefined);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.pullAll');

  (function() {
    QUnit.test('should work with the same value for `array` and `values`', function(assert) {
      assert.expect(1);

      var array = [{ 'a': 1 }, { 'b': 2 }],
          actual = _.pullAll(array, array);

      assert.deepEqual(actual, []);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.pullAllBy');

  (function() {
    QUnit.test('should accept an `iteratee` argument', function(assert) {
      assert.expect(1);

      var array = [{ 'x': 1 }, { 'x': 2 }, { 'x': 3 }, { 'x': 1 }];

      var actual = _.pullAllBy(array, [{ 'x': 1 }, { 'x': 3 }], function(object) {
        return object.x;
      });

      assert.deepEqual(actual, [{ 'x': 2 }]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args,
          array = [{ 'x': 1 }, { 'x': 2 }, { 'x': 3 }, { 'x': 1 }];

      _.pullAllBy(array, [{ 'x': 1 }, { 'x': 3 }], function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [{ 'x': 1 }]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.pullAllWith');

  (function() {
    QUnit.test('should work with a `comparator` argument', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 1, 'y': 1 }, { 'x': 2, 'y': 2 }, { 'x': 3, 'y': 3 }],
          expected = [objects[0], objects[2]],
          actual = _.pullAllWith(objects, [{ 'x': 2, 'y': 2 }], lodashStable.isEqual);

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('pull methods');

  lodashStable.each(['pull', 'pullAll', 'pullAllWith'], function(methodName) {
    var func = _[methodName],
        isPull = methodName == 'pull';

    function pull(array, values) {
      return isPull
        ? func.apply(undefined, [array].concat(values))
        : func(array, values);
    }

    QUnit.test('`_.' + methodName + '` should modify and return the array', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3],
          actual = pull(array, [1, 3]);

      assert.strictEqual(actual, array);
      assert.deepEqual(array, [2]);
    });

    QUnit.test('`_.' + methodName + '` should preserve holes in arrays', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3, 4];
      delete array[1];
      delete array[3];

      pull(array, [1]);
      assert.notOk('0' in array);
      assert.notOk('2' in array);
    });

    QUnit.test('`_.' + methodName + '` should treat holes as `undefined`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      delete array[1];

      pull(array, [undefined]);
      assert.deepEqual(array, [1, 3]);
    });

    QUnit.test('`_.' + methodName + '` should match `NaN`', function(assert) {
      assert.expect(1);

      var array = [1, NaN, 3, NaN];

      pull(array, [NaN]);
      assert.deepEqual(array, [1, 3]);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.pullAt');

  (function() {
    QUnit.test('should modify the array and return removed elements', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3],
          actual = _.pullAt(array, [0, 1]);

      assert.deepEqual(array, [3]);
      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('should work with unsorted indexes', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          actual = _.pullAt(array, [1, 3, 11, 7, 5, 9]);

      assert.deepEqual(array, [1, 3, 5, 7, 9, 11]);
      assert.deepEqual(actual, [2, 4, 12, 8, 6, 10]);
    });

    QUnit.test('should work with repeated indexes', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3, 4],
          actual = _.pullAt(array, [0, 2, 0, 1, 0, 2]);

      assert.deepEqual(array, [4]);
      assert.deepEqual(actual, [1, 3, 1, 2, 1, 3]);
    });

    QUnit.test('should use `undefined` for nonexistent indexes', function(assert) {
      assert.expect(2);

      var array = ['a', 'b', 'c'],
          actual = _.pullAt(array, [2, 4, 0]);

      assert.deepEqual(array, ['b']);
      assert.deepEqual(actual, ['c', undefined, 'a']);
    });

    QUnit.test('should flatten `indexes`', function(assert) {
      assert.expect(4);

      var array = ['a', 'b', 'c'];
      assert.deepEqual(_.pullAt(array, 2, 0), ['c', 'a']);
      assert.deepEqual(array, ['b']);

      array = ['a', 'b', 'c', 'd'];
      assert.deepEqual(_.pullAt(array, [3, 0], 2), ['d', 'a', 'c']);
      assert.deepEqual(array, ['b']);
    });

    QUnit.test('should return an empty array when no indexes are given', function(assert) {
      assert.expect(4);

      var array = ['a', 'b', 'c'],
          actual = _.pullAt(array);

      assert.deepEqual(array, ['a', 'b', 'c']);
      assert.deepEqual(actual, []);

      actual = _.pullAt(array, [], []);

      assert.deepEqual(array, ['a', 'b', 'c']);
      assert.deepEqual(actual, []);
    });

    QUnit.test('should work with non-index paths', function(assert) {
      assert.expect(2);

      var values = lodashStable.reject(empties, function(value) {
        return (value === 0) || lodashStable.isArray(value);
      }).concat(-1, 1.1);

      var array = lodashStable.transform(values, function(result, value) {
        result[value] = 1;
      }, []);

      var expected = lodashStable.map(values, stubOne),
          actual = _.pullAt(array, values);

      assert.deepEqual(actual, expected);

      expected = lodashStable.map(values, noop),
      actual = lodashStable.at(array, values);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var props = [-0, Object(-0), 0, Object(0)];

      var actual = lodashStable.map(props, function(key) {
        var array = [-1];
        array['-0'] = -2;
        return _.pullAt(array, key);
      });

      assert.deepEqual(actual, [[-2], [-2], [-1], [-1]]);
    });

    QUnit.test('should work with deep paths', function(assert) {
      assert.expect(3);

      var array = [];
      array.a = { 'b': 2 };

      var actual = _.pullAt(array, 'a.b');

      assert.deepEqual(actual, [2]);
      assert.deepEqual(array.a, {});

      try {
        actual = _.pullAt(array, 'a.b.c');
      } catch (e) {}

      assert.deepEqual(actual, [undefined]);
    });

    QUnit.test('should work with a falsey `array` argument when keys are given', function(assert) {
      assert.expect(1);

      var values = falsey.slice(),
          expected = lodashStable.map(values, lodashStable.constant(Array(4)));

      var actual = lodashStable.map(values, function(array) {
        try {
          return _.pullAt(array, 0, 1, 'pop', 'push');
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.random');

  (function() {
    var array = Array(1000);

    QUnit.test('should return `0` or `1` when no arguments are given', function(assert) {
      assert.expect(1);

      var actual = lodashStable.uniq(lodashStable.map(array, function() {
        return _.random();
      })).sort();

      assert.deepEqual(actual, [0, 1]);
    });

    QUnit.test('should support a `min` and `max` argument', function(assert) {
      assert.expect(1);

      var min = 5,
          max = 10;

      assert.ok(lodashStable.some(array, function() {
        var result = _.random(min, max);
        return result >= min && result <= max;
      }));
    });

    QUnit.test('should support not providing a `max` argument', function(assert) {
      assert.expect(1);

      var min = 0,
          max = 5;

      assert.ok(lodashStable.some(array, function() {
        var result = _.random(max);
        return result >= min && result <= max;
      }));
    });

    QUnit.test('should swap `min` and `max` when `min` > `max`', function(assert) {
      assert.expect(1);

      var min = 4,
          max = 2,
          expected = [2, 3, 4];

      var actual = lodashStable.uniq(lodashStable.map(array, function() {
        return _.random(min, max);
      })).sort();

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should support large integer values', function(assert) {
      assert.expect(2);

      var min = Math.pow(2, 31),
          max = Math.pow(2, 62);

      assert.ok(lodashStable.every(array, function() {
        var result = _.random(min, max);
        return result >= min && result <= max;
      }));

      assert.ok(lodashStable.some(array, function() {
        return _.random(MAX_INTEGER);
      }));
    });

    QUnit.test('should coerce arguments to finite numbers', function(assert) {
      assert.expect(1);

      var actual = [
        _.random(NaN, NaN),
        _.random('1', '1'),
        _.random(Infinity, Infinity)
      ];

      assert.deepEqual(actual, [0, 1, MAX_INTEGER]);
    });

    QUnit.test('should support floats', function(assert) {
      assert.expect(2);

      var min = 1.5,
          max = 1.6,
          actual = _.random(min, max);

      assert.ok(actual % 1);
      assert.ok(actual >= min && actual <= max);
    });

    QUnit.test('should support providing a `floating` argument', function(assert) {
      assert.expect(3);

      var actual = _.random(true);
      assert.ok(actual % 1 && actual >= 0 && actual <= 1);

      actual = _.random(2, true);
      assert.ok(actual % 1 && actual >= 0 && actual <= 2);

      actual = _.random(2, 4, true);
      assert.ok(actual % 1 && actual >= 2 && actual <= 4);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3],
          expected = lodashStable.map(array, stubTrue),
          randoms = lodashStable.map(array, _.random);

      var actual = lodashStable.map(randoms, function(result, index) {
        return result >= 0 && result <= array[index] && (result % 1) == 0;
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('range methods');

  lodashStable.each(['range', 'rangeRight'], function(methodName) {
    var func = _[methodName],
        isRange = methodName == 'range';

    function resolve(range) {
      return isRange ? range : range.reverse();
    }

    QUnit.test('`_.' + methodName + '` should infer the sign of `step` when only `end` is given', function(assert) {
      assert.expect(2);

      assert.deepEqual(func(4), resolve([0, 1, 2, 3]));
      assert.deepEqual(func(-4), resolve([0, -1, -2, -3]));
    });

    QUnit.test('`_.' + methodName + '` should infer the sign of `step` when only `start` and `end` are given', function(assert) {
      assert.expect(2);

      assert.deepEqual(func(1, 5), resolve([1, 2, 3, 4]));
      assert.deepEqual(func(5, 1), resolve([5, 4, 3, 2]));
    });

    QUnit.test('`_.' + methodName + '` should work with `start`, `end`, and `step` arguments', function(assert) {
      assert.expect(3);

      assert.deepEqual(func(0, -4, -1), resolve([0, -1, -2, -3]));
      assert.deepEqual(func(5, 1, -1), resolve([5, 4, 3, 2]));
      assert.deepEqual(func(0, 20, 5), resolve([0, 5, 10, 15]));
    });

    QUnit.test('`_.' + methodName + '` should support a `step` of `0`', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(1, 4, 0), [1, 1, 1]);
    });

    QUnit.test('`_.' + methodName + '` should work with a `step` larger than `end`', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(1, 5, 20), [1]);
    });

    QUnit.test('`_.' + methodName + '` should work with a negative `step`', function(assert) {
      assert.expect(2);

      assert.deepEqual(func(0, -4, -1), resolve([0, -1, -2, -3]));
      assert.deepEqual(func(21, 10, -3), resolve([21, 18, 15, 12]));
    });

    QUnit.test('`_.' + methodName + '` should support `start` of `-0`', function(assert) {
      assert.expect(1);

      var actual = func(-0, 1);
      assert.strictEqual(1 / actual[0], -Infinity);
    });

    QUnit.test('`_.' + methodName + '` should treat falsey `start` arguments as `0`', function(assert) {
      assert.expect(13);

      lodashStable.each(falsey, function(value, index) {
        if (index) {
          assert.deepEqual(func(value), []);
          assert.deepEqual(func(value, 1), [0]);
        } else {
          assert.deepEqual(func(), []);
        }
      });
    });

    QUnit.test('`_.' + methodName + '` should coerce arguments to finite numbers', function(assert) {
      assert.expect(1);

      var actual = [
        func('1'),
        func('0', 1),
        func(0, 1, '1'),
        func(NaN),
        func(NaN, NaN)
      ];

      assert.deepEqual(actual, [[0], [0], [0], [], []]);
    });

    QUnit.test('`_.' + methodName + '` should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3],
          object = { 'a': 1, 'b': 2, 'c': 3 },
          expected = lodashStable.map([[0], [0, 1], [0, 1, 2]], resolve);

      lodashStable.each([array, object], function(collection) {
        var actual = lodashStable.map(collection, func);
        assert.deepEqual(actual, expected);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.rearg');

  (function() {
    function fn() {
      return slice.call(arguments);
    }

    QUnit.test('should reorder arguments provided to `func`', function(assert) {
      assert.expect(1);

      var rearged = _.rearg(fn, [2, 0, 1]);
      assert.deepEqual(rearged('b', 'c', 'a'), ['a', 'b', 'c']);
    });

    QUnit.test('should work with repeated indexes', function(assert) {
      assert.expect(1);

      var rearged = _.rearg(fn, [1, 1, 1]);
      assert.deepEqual(rearged('c', 'a', 'b'), ['a', 'a', 'a']);
    });

    QUnit.test('should use `undefined` for nonexistent indexes', function(assert) {
      assert.expect(1);

      var rearged = _.rearg(fn, [1, 4]);
      assert.deepEqual(rearged('b', 'a', 'c'), ['a', undefined, 'c']);
    });

    QUnit.test('should use `undefined` for non-index values', function(assert) {
      assert.expect(1);

      var values = lodashStable.reject(empties, function(value) {
        return (value === 0) || lodashStable.isArray(value);
      }).concat(-1, 1.1);

      var expected = lodashStable.map(values, lodashStable.constant([undefined, 'b', 'c']));

      var actual = lodashStable.map(values, function(value) {
        var rearged = _.rearg(fn, [value]);
        return rearged('a', 'b', 'c');
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not rearrange arguments when no indexes are given', function(assert) {
      assert.expect(2);

      var rearged = _.rearg(fn);
      assert.deepEqual(rearged('a', 'b', 'c'), ['a', 'b', 'c']);

      rearged = _.rearg(fn, [], []);
      assert.deepEqual(rearged('a', 'b', 'c'), ['a', 'b', 'c']);
    });

    QUnit.test('should accept multiple index arguments', function(assert) {
      assert.expect(1);

      var rearged = _.rearg(fn, 2, 0, 1);
      assert.deepEqual(rearged('b', 'c', 'a'), ['a', 'b', 'c']);
    });

    QUnit.test('should accept multiple arrays of indexes', function(assert) {
      assert.expect(1);

      var rearged = _.rearg(fn, [2], [0, 1]);
      assert.deepEqual(rearged('b', 'c', 'a'), ['a', 'b', 'c']);
    });

    QUnit.test('should work with fewer indexes than arguments', function(assert) {
      assert.expect(1);

      var rearged = _.rearg(fn, [1, 0]);
      assert.deepEqual(rearged('b', 'a', 'c'), ['a', 'b', 'c']);
    });

    QUnit.test('should work on functions that have been rearged', function(assert) {
      assert.expect(1);

      var rearged1 = _.rearg(fn, 2, 1, 0),
          rearged2 = _.rearg(rearged1, 1, 0, 2);

      assert.deepEqual(rearged2('b', 'c', 'a'), ['a', 'b', 'c']);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.reduce');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should use the first element of a collection as the default `accumulator`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.reduce(array), 1);
    });

    QUnit.test('should provide correct `iteratee` arguments when iterating an array', function(assert) {
      assert.expect(2);

      var args;

      _.reduce(array, function() {
        args || (args = slice.call(arguments));
      }, 0);

      assert.deepEqual(args, [0, 1, 0, array]);

      args = undefined;
      _.reduce(array, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [1, 2, 1, array]);
    });

    QUnit.test('should provide correct `iteratee` arguments when iterating an object', function(assert) {
      assert.expect(2);

      var args,
          object = { 'a': 1, 'b': 2 },
          firstKey = _.head(_.keys(object));

      var expected = firstKey == 'a'
        ? [0, 1, 'a', object]
        : [0, 2, 'b', object];

      _.reduce(object, function() {
        args || (args = slice.call(arguments));
      }, 0);

      assert.deepEqual(args, expected);

      args = undefined;
      expected = firstKey == 'a'
        ? [1, 2, 'b', object]
        : [2, 1, 'a', object];

      _.reduce(object, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.reduceRight');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should use the last element of a collection as the default `accumulator`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.reduceRight(array), 3);
    });

    QUnit.test('should provide correct `iteratee` arguments when iterating an array', function(assert) {
      assert.expect(2);

      var args;

      _.reduceRight(array, function() {
        args || (args = slice.call(arguments));
      }, 0);

      assert.deepEqual(args, [0, 3, 2, array]);

      args = undefined;
      _.reduceRight(array, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [3, 2, 1, array]);
    });

    QUnit.test('should provide correct `iteratee` arguments when iterating an object', function(assert) {
      assert.expect(2);

      var args,
          object = { 'a': 1, 'b': 2 },
          isFIFO = lodashStable.keys(object)[0] == 'a';

      var expected = isFIFO
        ? [0, 2, 'b', object]
        : [0, 1, 'a', object];

      _.reduceRight(object, function() {
        args || (args = slice.call(arguments));
      }, 0);

      assert.deepEqual(args, expected);

      args = undefined;
      expected = isFIFO
        ? [2, 1, 'a', object]
        : [1, 2, 'b', object];

      _.reduceRight(object, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('reduce methods');

  lodashStable.each(['reduce', 'reduceRight'], function(methodName) {
    var func = _[methodName],
        array = [1, 2, 3],
        isReduce = methodName == 'reduce';

    QUnit.test('`_.' + methodName + '` should reduce a collection to a single value', function(assert) {
      assert.expect(1);

      var actual = func(['a', 'b', 'c'], function(accumulator, value) {
        return accumulator + value;
      }, '');

      assert.strictEqual(actual, isReduce ? 'abc' : 'cba');
    });

    QUnit.test('`_.' + methodName + '` should support empty collections without an initial `accumulator` value', function(assert) {
      assert.expect(1);

      var actual = [],
          expected = lodashStable.map(empties, noop);

      lodashStable.each(empties, function(value) {
        try {
          actual.push(func(value, noop));
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should support empty collections with an initial `accumulator` value', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, lodashStable.constant('x'));

      var actual = lodashStable.map(empties, function(value) {
        try {
          return func(value, noop, 'x');
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should handle an initial `accumulator` value of `undefined`', function(assert) {
      assert.expect(1);

      var actual = func([], noop, undefined);
      assert.strictEqual(actual, undefined);
    });

    QUnit.test('`_.' + methodName + '` should return `undefined` for empty collections when no `accumulator` is given (test in IE > 9 and modern browsers)', function(assert) {
      assert.expect(2);

      var array = [],
          object = { '0': 1, 'length': 0 };

      if ('__proto__' in array) {
        array.__proto__ = object;
        assert.strictEqual(func(array, noop), undefined);
      }
      else {
        skipAssert(assert);
      }
      assert.strictEqual(func(object, noop), undefined);
    });

    QUnit.test('`_.' + methodName + '` should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.strictEqual(_(array)[methodName](add), 6);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(array).chain()[methodName](add) instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.reject');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should return elements the `predicate` returns falsey for', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.reject(array, isEven), [1, 3]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('filter methods');

  lodashStable.each(['filter', 'reject'], function(methodName) {
    var array = [1, 2, 3, 4],
        func = _[methodName],
        isFilter = methodName == 'filter',
        objects = [{ 'a': 0 }, { 'a': 1 }];

    QUnit.test('`_.' + methodName + '` should not modify the resulting value from within `predicate`', function(assert) {
      assert.expect(1);

      var actual = func([0], function(value, index, array) {
        array[index] = 1;
        return isFilter;
      });

      assert.deepEqual(actual, [0]);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(objects, 'a'), [objects[isFilter ? 1 : 0]]);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(objects, objects[1]), [objects[isFilter ? 1 : 0]]);
    });

    QUnit.test('`_.' + methodName + '` should not modify wrapped values', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _(array);

        var actual = wrapped[methodName](function(n) {
          return n < 3;
        });

        assert.deepEqual(actual.value(), isFilter ? [1, 2] : [3, 4]);

        actual = wrapped[methodName](function(n) {
          return n > 2;
        });

        assert.deepEqual(actual.value(), isFilter ? [3, 4] : [1, 2]);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('`_.' + methodName + '` should work in a lazy sequence', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE + 1),
            predicate = function(value) { return isFilter ? isEven(value) : !isEven(value); };

        var object = lodashStable.zipObject(lodashStable.times(LARGE_ARRAY_SIZE, function(index) {
          return ['key' + index, index];
        }));

        var actual = _(array).slice(1).map(square)[methodName](predicate).value();
        assert.deepEqual(actual, _[methodName](lodashStable.map(array.slice(1), square), predicate));

        actual = _(object).mapValues(square)[methodName](predicate).value();
        assert.deepEqual(actual, _[methodName](lodashStable.mapValues(object, square), predicate));
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('`_.' + methodName + '` should provide correct `predicate` arguments in a lazy sequence', function(assert) {
      assert.expect(5);

      if (!isNpm) {
        var args,
            array = lodashStable.range(LARGE_ARRAY_SIZE + 1),
            expected = [1, 0, lodashStable.map(array.slice(1), square)];

        _(array).slice(1)[methodName](function(value, index, array) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, [1, 0, array.slice(1)]);

        args = undefined;
        _(array).slice(1).map(square)[methodName](function(value, index, array) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, expected);

        args = undefined;
        _(array).slice(1).map(square)[methodName](function(value, index) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, expected);

        args = undefined;
        _(array).slice(1).map(square)[methodName](function(value) {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, [1]);

        args = undefined;
        _(array).slice(1).map(square)[methodName](function() {
          args || (args = slice.call(arguments));
        }).value();

        assert.deepEqual(args, expected);
      }
      else {
        skipAssert(assert, 5);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.remove');

  (function() {
    QUnit.test('should modify the array and return removed elements', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3, 4],
          actual = _.remove(array, isEven);

      assert.deepEqual(array, [1, 3]);
      assert.deepEqual(actual, [2, 4]);
    });

    QUnit.test('should provide correct `predicate` arguments', function(assert) {
      assert.expect(1);

      var argsList = [],
          array = [1, 2, 3],
          clone = array.slice();

      _.remove(array, function(n, index) {
        var args = slice.call(arguments);
        args[2] = args[2].slice();
        argsList.push(args);
        return isEven(index);
      });

      assert.deepEqual(argsList, [[1, 0, clone], [2, 1, clone], [3, 2, clone]]);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': 0, 'b': 1 }, { 'a': 1, 'b': 2 }];
      _.remove(objects, { 'a': 1 });
      assert.deepEqual(objects, [{ 'a': 0, 'b': 1 }]);
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': 0, 'b': 1 }, { 'a': 1, 'b': 2 }];
      _.remove(objects, ['a', 1]);
      assert.deepEqual(objects, [{ 'a': 0, 'b': 1 }]);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var objects = [{ 'a': 0 }, { 'a': 1 }];
      _.remove(objects, 'a');
      assert.deepEqual(objects, [{ 'a': 0 }]);
    });

    QUnit.test('should preserve holes in arrays', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3, 4];
      delete array[1];
      delete array[3];

      _.remove(array, function(n) {
        return n === 1;
      });

      assert.notOk('0' in array);
      assert.notOk('2' in array);
    });

    QUnit.test('should treat holes as `undefined`', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];
      delete array[1];

      _.remove(array, function(n) {
        return n == null;
      });

      assert.deepEqual(array, [1, 3]);
    });

    QUnit.test('should not mutate the array until all elements to remove are determined', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3];

      _.remove(array, function(n, index) {
        return isEven(index);
      });

      assert.deepEqual(array, [2]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.repeat');

  (function() {
    var string = 'abc';

    QUnit.test('should repeat a string `n` times', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.repeat('*', 3), '***');
      assert.strictEqual(_.repeat(string, 2), 'abcabc');
    });

    QUnit.test('should treat falsey `n` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? string : '';
      });

      var actual = lodashStable.map(falsey, function(n, index) {
        return index ? _.repeat(string, n) : _.repeat(string);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an empty string if `n` is <= `0`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.repeat(string, 0), '');
      assert.strictEqual(_.repeat(string, -2), '');
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.repeat(string, '2'), 'abcabc');
      assert.strictEqual(_.repeat(string, 2.6), 'abcabc');
      assert.strictEqual(_.repeat('*', { 'valueOf': stubThree }), '***');
    });

    QUnit.test('should coerce `string` to a string', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.repeat(Object(string), 2), 'abcabc');
      assert.strictEqual(_.repeat({ 'toString': lodashStable.constant('*') }, 3), '***');
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(['a', 'b', 'c'], _.repeat);
      assert.deepEqual(actual, ['a', 'b', 'c']);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.replace');

  (function() {
    QUnit.test('should replace the matched pattern', function(assert) {
      assert.expect(2);

      var string = 'abcde';
      assert.strictEqual(_.replace(string, 'de', '123'), 'abc123');
      assert.strictEqual(_.replace(string, /[bd]/g, '-'), 'a-c-e');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.result');

  (function() {
    var object = { 'a': 1, 'b': stubB };

    QUnit.test('should invoke function values', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.result(object, 'b'), 'b');
    });

    QUnit.test('should invoke default function values', function(assert) {
      assert.expect(1);

      var actual = _.result(object, 'c', object.b);
      assert.strictEqual(actual, 'b');
    });

    QUnit.test('should invoke nested function values', function(assert) {
      assert.expect(2);

      var value = { 'a': lodashStable.constant({ 'b': stubB }) };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(_.result(value, path), 'b');
      });
    });

    QUnit.test('should invoke deep property methods with the correct `this` binding', function(assert) {
      assert.expect(2);

      var value = { 'a': { 'b': function() { return this.c; }, 'c': 1 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(_.result(value, path), 1);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.get and lodash.result');

  lodashStable.each(['get', 'result'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should get string keyed property values', function(assert) {
      assert.expect(2);

      var object = { 'a': 1 };

      lodashStable.each(['a', ['a']], function(path) {
        assert.strictEqual(func(object, path), 1);
      });
    });

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var object = { '-0': 'a', '0': 'b' },
          props = [-0, Object(-0), 0, Object(0)];

      var actual = lodashStable.map(props, function(key) {
        return func(object, key);
      });

      assert.deepEqual(actual, ['a', 'a', 'b', 'b']);
    });

    QUnit.test('`_.' + methodName + '` should get symbol keyed property values', function(assert) {
      assert.expect(1);

      if (Symbol) {
        var object = {};
        object[symbol] = 1;

        assert.strictEqual(func(object, symbol), 1);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should get deep property values', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': 2 } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(func(object, path), 2);
      });
    });

    QUnit.test('`_.' + methodName + '` should get a key over a path', function(assert) {
      assert.expect(2);

      var object = { 'a.b': 1, 'a': { 'b': 2 } };

      lodashStable.each(['a.b', ['a.b']], function(path) {
        assert.strictEqual(func(object, path), 1);
      });
    });

    QUnit.test('`_.' + methodName + '` should not coerce array paths to strings', function(assert) {
      assert.expect(1);

      var object = { 'a,b,c': 3, 'a': { 'b': { 'c': 4 } } };
      assert.strictEqual(func(object, ['a', 'b', 'c']), 4);
    });

    QUnit.test('`_.' + methodName + '` should not ignore empty brackets', function(assert) {
      assert.expect(1);

      var object = { 'a': { '': 1 } };
      assert.strictEqual(func(object, 'a[]'), 1);
    });

    QUnit.test('`_.' + methodName + '` should handle empty paths', function(assert) {
      assert.expect(4);

      lodashStable.each([['', ''], [[], ['']]], function(pair) {
        assert.strictEqual(func({}, pair[0]), undefined);
        assert.strictEqual(func({ '': 3 }, pair[1]), 3);
      });
    });

    QUnit.test('`_.' + methodName + '` should handle complex paths', function(assert) {
      assert.expect(2);

      var object = { 'a': { '-1.23': { '["b"]': { 'c': { "['d']": { '\ne\n': { 'f': { 'g': 8 } } } } } } } };

      var paths = [
        'a[-1.23]["[\\"b\\"]"].c[\'[\\\'d\\\']\'][\ne\n][f].g',
        ['a', '-1.23', '["b"]', 'c', "['d']", '\ne\n', 'f', 'g']
      ];

      lodashStable.each(paths, function(path) {
        assert.strictEqual(func(object, path), 8);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `undefined` when `object` is nullish', function(assert) {
      assert.expect(4);

      lodashStable.each(['constructor', ['constructor']], function(path) {
        assert.strictEqual(func(null, path), undefined);
        assert.strictEqual(func(undefined, path), undefined);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `undefined` with deep paths when `object` is nullish', function(assert) {
      assert.expect(2);

      var values = [null, undefined],
          expected = lodashStable.map(values, noop),
          paths = ['constructor.prototype.valueOf', ['constructor', 'prototype', 'valueOf']];

      lodashStable.each(paths, function(path) {
        var actual = lodashStable.map(values, function(value) {
          return func(value, path);
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should return `undefined` if parts of `path` are missing', function(assert) {
      assert.expect(2);

      var object = { 'a': [, null] };

      lodashStable.each(['a[1].b.c', ['a', '1', 'b', 'c']], function(path) {
        assert.strictEqual(func(object, path), undefined);
      });
    });

    QUnit.test('`_.' + methodName + '` should be able to return `null` values', function(assert) {
      assert.expect(2);

      var object = { 'a': { 'b': null } };

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        assert.strictEqual(func(object, path), null);
      });
    });

    QUnit.test('`_.' + methodName + '` should follow `path` over non-plain objects', function(assert) {
      assert.expect(2);

      var paths = ['a.b', ['a', 'b']];

      lodashStable.each(paths, function(path) {
        numberProto.a = { 'b': 2 };
        assert.strictEqual(func(0, path), 2);
        delete numberProto.a;
      });
    });

    QUnit.test('`_.' + methodName + '` should return the default value for `undefined` values', function(assert) {
      assert.expect(1);

      var object = { 'a': {} },
          values = empties.concat(true, new Date, 1, /x/, 'a');

      var expected = lodashStable.transform(values, function(result, value) {
        result.push(value, value, value, value);
      });

      var actual = lodashStable.transform(values, function(result, value) {
        lodashStable.each(['a.b', ['a', 'b']], function(path) {
          result.push(
            func(object, path, value),
            func(null, path, value)
          );
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should return the default value when `path` is empty', function(assert) {
      assert.expect(1);

      assert.strictEqual(func({}, [], 'a'), 'a');
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.rest');

  (function() {
    function fn(a, b, c) {
      return slice.call(arguments);
    }

    QUnit.test('should apply a rest parameter to `func`', function(assert) {
      assert.expect(1);

      var rest = _.rest(fn);
      assert.deepEqual(rest(1, 2, 3, 4), [1, 2, [3, 4]]);
    });

    QUnit.test('should work with `start`', function(assert) {
      assert.expect(1);

      var rest = _.rest(fn, 1);
      assert.deepEqual(rest(1, 2, 3, 4), [1, [2, 3, 4]]);
    });

    QUnit.test('should treat `start` as `0` for `NaN` or negative values', function(assert) {
      assert.expect(1);

      var values = [-1, NaN, 'a'],
          expected = lodashStable.map(values, lodashStable.constant([[1, 2, 3, 4]]));

      var actual = lodashStable.map(values, function(value) {
        var rest = _.rest(fn, value);
        return rest(1, 2, 3, 4);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should coerce `start` to an integer', function(assert) {
      assert.expect(1);

      var rest = _.rest(fn, 1.6);
      assert.deepEqual(rest(1, 2, 3), [1, [2, 3]]);
    });

    QUnit.test('should use an empty array when `start` is not reached', function(assert) {
      assert.expect(1);

      var rest = _.rest(fn);
      assert.deepEqual(rest(1), [1, undefined, []]);
    });

    QUnit.test('should work on functions with more than three parameters', function(assert) {
      assert.expect(1);

      var rest = _.rest(function(a, b, c, d) {
        return slice.call(arguments);
      });

      assert.deepEqual(rest(1, 2, 3, 4, 5), [1, 2, 3, [4, 5]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.reverse');

  (function() {
    var largeArray = lodashStable.range(LARGE_ARRAY_SIZE).concat(null),
        smallArray = [0, 1, 2, null];

    QUnit.test('should reverse `array`', function(assert) {
      assert.expect(2);

      var array = [1, 2, 3],
          actual = _.reverse(array);

      assert.strictEqual(actual, array);
      assert.deepEqual(array, [3, 2, 1]);
    });

    QUnit.test('should return the wrapped reversed `array`', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        lodashStable.times(2, function(index) {
          var array = (index ? largeArray : smallArray).slice(),
              clone = array.slice(),
              wrapped = _(array).reverse(),
              actual = wrapped.value();

          assert.ok(wrapped instanceof _);
          assert.strictEqual(actual, array);
          assert.deepEqual(actual, clone.slice().reverse());
        });
      }
      else {
        skipAssert(assert, 6);
      }
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        lodashStable.times(2, function(index) {
          var array = (index ? largeArray : smallArray).slice(),
              expected = array.slice(),
              actual = _(array).slice(1).reverse().value();

          assert.deepEqual(actual, expected.slice(1).reverse());
          assert.deepEqual(array, expected);
        });
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should be lazy when in a lazy sequence', function(assert) {
      assert.expect(3);

      if (!isNpm) {
        var spy = {
          'toString': function() {
            throw new Error('spy was revealed');
          }
        };

        var array = largeArray.concat(spy),
            expected = array.slice();

        try {
          var wrapped = _(array).slice(1).map(String).reverse(),
              actual = wrapped.last();
        } catch (e) {}

        assert.ok(wrapped instanceof _);
        assert.strictEqual(actual, '1');
        assert.deepEqual(array, expected);
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should work in a hybrid sequence', function(assert) {
      assert.expect(8);

      if (!isNpm) {
        lodashStable.times(2, function(index) {
          var clone = (index ? largeArray : smallArray).slice();

          lodashStable.each(['map', 'filter'], function(methodName) {
            var array = clone.slice(),
                expected = clone.slice(1, -1).reverse(),
                actual = _(array)[methodName](identity).thru(_.compact).reverse().value();

            assert.deepEqual(actual, expected);

            array = clone.slice();
            actual = _(array).thru(_.compact)[methodName](identity).pull(1).push(3).reverse().value();

            assert.deepEqual(actual, [3].concat(expected.slice(0, -1)));
          });
        });
      }
      else {
        skipAssert(assert, 8);
      }
    });

    QUnit.test('should track the `__chain__` value of a wrapper', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        lodashStable.times(2, function(index) {
          var array = (index ? largeArray : smallArray).slice(),
              expected = array.slice().reverse(),
              wrapped = _(array).chain().reverse().head();

          assert.ok(wrapped instanceof _);
          assert.strictEqual(wrapped.value(), _.head(expected));
          assert.deepEqual(array, expected);
        });
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('round methods');

  lodashStable.each(['ceil', 'floor', 'round'], function(methodName) {
    var func = _[methodName],
        isCeil = methodName == 'ceil',
        isFloor = methodName == 'floor';

    QUnit.test('`_.' + methodName + '` should return a rounded number without a precision', function(assert) {
      assert.expect(1);

      var actual = func(4.006);
      assert.strictEqual(actual, isCeil ? 5 : 4);
    });

    QUnit.test('`_.' + methodName + '` should work with a precision of `0`', function(assert) {
      assert.expect(1);

      var actual = func(4.006, 0);
      assert.strictEqual(actual, isCeil ? 5 : 4);
    });

    QUnit.test('`_.' + methodName + '` should work with a positive precision', function(assert) {
      assert.expect(2);

      var actual = func(4.016, 2);
      assert.strictEqual(actual, isFloor ? 4.01 : 4.02);

      actual = func(4.1, 2);
      assert.strictEqual(actual, 4.1);
    });

    QUnit.test('`_.' + methodName + '` should work with a negative precision', function(assert) {
      assert.expect(1);

      var actual = func(4160, -2);
      assert.strictEqual(actual, isFloor ? 4100 : 4200);
    });

    QUnit.test('`_.' + methodName + '` should coerce `precision` to an integer', function(assert) {
      assert.expect(3);

      var actual = func(4.006, NaN);
      assert.strictEqual(actual, isCeil ? 5 : 4);

      var expected = isFloor ? 4.01 : 4.02;

      actual = func(4.016, 2.6);
      assert.strictEqual(actual, expected);

      actual = func(4.016, '+2');
      assert.strictEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with exponential notation and `precision`', function(assert) {
      assert.expect(3);

      var actual = func(5e1, 2);
      assert.deepEqual(actual, 50);

      actual = func('5e', 1);
      assert.deepEqual(actual, NaN);

      actual = func('5e1e1', 1);
      assert.deepEqual(actual, NaN);
    });

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var values = [[0], [-0], ['0'], ['-0'], [0, 1], [-0, 1], ['0', 1], ['-0', 1]],
          expected = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity];

      var actual = lodashStable.map(values, function(args) {
        return 1 / func.apply(undefined, args);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should not return `NaN` for large `precision` values', function(assert) {
      assert.expect(1);

      var results = [
        _.round(10.0000001, 1000),
        _.round(MAX_SAFE_INTEGER, 293)
      ];

      var expected = lodashStable.map(results, stubFalse),
          actual = lodashStable.map(results, lodashStable.isNaN);

      assert.deepEqual(actual, expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.runInContext');

  (function() {
    QUnit.test('should not require a fully populated `context` object', function(assert) {
      assert.expect(1);

      if (!isModularize) {
        var lodash = _.runInContext({
          'setTimeout': function(func) { func(); }
        });

        var pass = false;
        lodash.delay(function() { pass = true; }, 32);
        assert.ok(pass);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should use a zeroed `_.uniqueId` counter', function(assert) {
      assert.expect(3);

      if (!isModularize) {
        lodashStable.times(2, _.uniqueId);

        var oldId = Number(_.uniqueId()),
            lodash = _.runInContext();

        assert.ok(_.uniqueId() > oldId);

        var id = lodash.uniqueId();
        assert.strictEqual(id, '1');
        assert.ok(id < oldId);
      }
      else {
        skipAssert(assert, 3);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.sample');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should return a random element', function(assert) {
      assert.expect(1);

      var actual = _.sample(array);
      assert.ok(lodashStable.includes(array, actual));
    });

    QUnit.test('should return `undefined` when sampling empty collections', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, noop);

      var actual = lodashStable.transform(empties, function(result, value) {
        try {
          result.push(_.sample(value));
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should sample an object', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2, 'c': 3 },
          actual = _.sample(object);

      assert.ok(lodashStable.includes(array, actual));
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.sampleSize');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should return an array of random elements', function(assert) {
      assert.expect(2);

      var actual = _.sampleSize(array, 2);

      assert.strictEqual(actual.length, 2);
      assert.deepEqual(lodashStable.difference(actual, array), []);
    });

    QUnit.test('should contain elements of the collection', function(assert) {
      assert.expect(1);

      var actual = _.sampleSize(array, array.length).sort();

      assert.deepEqual(actual, array);
    });

    QUnit.test('should treat falsey `size` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? ['a'] : [];
      });

      var actual = lodashStable.map(falsey, function(size, index) {
        return index ? _.sampleSize(['a'], size) : _.sampleSize(['a']);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an empty array when `n` < `1` or `NaN`', function(assert) {
      assert.expect(3);

      lodashStable.each([0, -1, -Infinity], function(n) {
        assert.deepEqual(_.sampleSize(array, n), []);
      });
    });

    QUnit.test('should return all elements when `n` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(n) {
        var actual = _.sampleSize(array, n).sort();
        assert.deepEqual(actual, array);
      });
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(1);

      var actual = _.sampleSize(array, 1.6);
      assert.strictEqual(actual.length, 1);
    });

    QUnit.test('should return an empty array for empty collections', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, stubArray);

      var actual = lodashStable.transform(empties, function(result, value) {
        try {
          result.push(_.sampleSize(value, 1));
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should sample an object', function(assert) {
      assert.expect(2);

      var object = { 'a': 1, 'b': 2, 'c': 3 },
          actual = _.sampleSize(object, 2);

      assert.strictEqual(actual.length, 2);
      assert.deepEqual(lodashStable.difference(actual, lodashStable.values(object)), []);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map([['a']], _.sampleSize);
      assert.deepEqual(actual, [['a']]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.setWith');

  (function() {
    QUnit.test('should work with a `customizer` callback', function(assert) {
      assert.expect(1);

      var actual = _.setWith({ '0': {} }, '[0][1][2]', 3, function(value) {
        return lodashStable.isObject(value) ? undefined : {};
      });

      assert.deepEqual(actual, { '0': { '1': { '2': 3 } } });
    });

    QUnit.test('should work with a `customizer` that returns `undefined`', function(assert) {
      assert.expect(1);

      var actual = _.setWith({}, 'a[0].b.c', 4, noop);
      assert.deepEqual(actual, { 'a': [{ 'b': { 'c': 4 } }] });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('set methods');

  lodashStable.each(['update', 'updateWith', 'set', 'setWith'], function(methodName) {
    var func = _[methodName],
        isUpdate = methodName == 'update' || methodName == 'updateWith';

    var oldValue = 1,
        value = 2,
        updater = isUpdate ? lodashStable.constant(value) : value;

    QUnit.test('`_.' + methodName + '` should set property values', function(assert) {
      assert.expect(4);

      lodashStable.each(['a', ['a']], function(path) {
        var object = { 'a': oldValue },
            actual = func(object, path, updater);

        assert.strictEqual(actual, object);
        assert.strictEqual(object.a, value);
      });
    });

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var props = [-0, Object(-0), 0, Object(0)],
          expected = lodashStable.map(props, lodashStable.constant(value));

      var actual = lodashStable.map(props, function(key) {
        var object = { '-0': 'a', '0': 'b' };
        func(object, key, updater);
        return object[lodashStable.toString(key)];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should unset symbol keyed property values', function(assert) {
      assert.expect(2);

      if (Symbol) {
        var object = {};
        object[symbol] = 1;

        assert.strictEqual(_.unset(object, symbol), true);
        assert.notOk(symbol in object);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('`_.' + methodName + '` should set deep property values', function(assert) {
      assert.expect(4);

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var object = { 'a': { 'b': oldValue } },
            actual = func(object, path, updater);

        assert.strictEqual(actual, object);
        assert.strictEqual(object.a.b, value);
      });
    });

    QUnit.test('`_.' + methodName + '` should set a key over a path', function(assert) {
      assert.expect(4);

      lodashStable.each(['a.b', ['a.b']], function(path) {
        var object = { 'a.b': oldValue },
            actual = func(object, path, updater);

        assert.strictEqual(actual, object);
        assert.deepEqual(object, { 'a.b': value });
      });
    });

    QUnit.test('`_.' + methodName + '` should not coerce array paths to strings', function(assert) {
      assert.expect(1);

      var object = { 'a,b,c': 1, 'a': { 'b': { 'c': 1 } } };

      func(object, ['a', 'b', 'c'], updater);
      assert.strictEqual(object.a.b.c, value);
    });

    QUnit.test('`_.' + methodName + '` should not ignore empty brackets', function(assert) {
      assert.expect(1);

      var object = {};

      func(object, 'a[]', updater);
      assert.deepEqual(object, { 'a': { '': value } });
    });

    QUnit.test('`_.' + methodName + '` should handle empty paths', function(assert) {
      assert.expect(4);

      lodashStable.each([['', ''], [[], ['']]], function(pair, index) {
        var object = {};

        func(object, pair[0], updater);
        assert.deepEqual(object, index ? {} : { '': value });

        func(object, pair[1], updater);
        assert.deepEqual(object, { '': value });
      });
    });

    QUnit.test('`_.' + methodName + '` should handle complex paths', function(assert) {
      assert.expect(2);

      var object = { 'a': { '1.23': { '["b"]': { 'c': { "['d']": { '\ne\n': { 'f': { 'g': oldValue } } } } } } } };

      var paths = [
        'a[-1.23]["[\\"b\\"]"].c[\'[\\\'d\\\']\'][\ne\n][f].g',
        ['a', '-1.23', '["b"]', 'c', "['d']", '\ne\n', 'f', 'g']
      ];

      lodashStable.each(paths, function(path) {
        func(object, path, updater);
        assert.strictEqual(object.a[-1.23]['["b"]'].c["['d']"]['\ne\n'].f.g, value);
        object.a[-1.23]['["b"]'].c["['d']"]['\ne\n'].f.g = oldValue;
      });
    });

    QUnit.test('`_.' + methodName + '` should create parts of `path` that are missing', function(assert) {
      assert.expect(6);

      var object = {};

      lodashStable.each(['a[1].b.c', ['a', '1', 'b', 'c']], function(path) {
        var actual = func(object, path, updater);

        assert.strictEqual(actual, object);
        assert.deepEqual(actual, { 'a': [undefined, { 'b': { 'c': value } }] });
        assert.notOk('0' in object.a);

        delete object.a;
      });
    });

    QUnit.test('`_.' + methodName + '` should not error when `object` is nullish', function(assert) {
      assert.expect(1);

      var values = [null, undefined],
          expected = [[null, null], [undefined, undefined]];

      var actual = lodashStable.map(values, function(value) {
        try {
          return [func(value, 'a.b', updater), func(value, ['a', 'b'], updater)];
        } catch (e) {
          return e.message;
        }
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should overwrite primitives in the path', function(assert) {
      assert.expect(2);

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var object = { 'a': '' };

        func(object, path, updater);
        assert.deepEqual(object, { 'a': { 'b': 2 } });
      });;
    });

    QUnit.test('`_.' + methodName + '` should not create an array for missing non-index property names that start with numbers', function(assert) {
      assert.expect(1);

      var object = {};

      func(object, ['1a', '2b', '3c'], updater);
      assert.deepEqual(object, { '1a': { '2b': { '3c': value } } });
    });

    QUnit.test('`_.' + methodName + '` should not assign values that are the same as their destinations', function(assert) {
      assert.expect(4);

      lodashStable.each(['a', ['a'], { 'a': 1 }, NaN], function(value) {
        var object = {},
            pass = true,
            updater = isUpdate ? lodashStable.constant(value) : value;

        defineProperty(object, 'a', {
          'enumerable': true,
          'configurable': true,
          'get': lodashStable.constant(value),
          'set': function() { pass = false; }
        });

        func(object, 'a', updater);
        assert.ok(pass);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.shuffle');

  (function() {
    var array = [1, 2, 3],
        object = { 'a': 1, 'b': 2, 'c': 3 };

    QUnit.test('should return a new array', function(assert) {
      assert.expect(1);

      assert.notStrictEqual(_.shuffle(array), array);
    });

    QUnit.test('should contain the same elements after a collection is shuffled', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.shuffle(array).sort(), array);
      assert.deepEqual(_.shuffle(object).sort(), array);
    });

    QUnit.test('should shuffle small collections', function(assert) {
      assert.expect(1);

      var actual = lodashStable.times(1000, function(assert) {
        return _.shuffle([1, 2]);
      });

      assert.deepEqual(lodashStable.sortBy(lodashStable.uniqBy(actual, String), '0'), [[1, 2], [2, 1]]);
    });

    QUnit.test('should treat number values for `collection` as empty', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.shuffle(1), []);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.size');

  (function() {
    var args = arguments,
        array = [1, 2, 3];

    QUnit.test('should return the number of own enumerable string keyed properties of an object', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.size({ 'one': 1, 'two': 2, 'three': 3 }), 3);
    });

    QUnit.test('should return the length of an array', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.size(array), 3);
    });

    QUnit.test('should accept a falsey `object` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubZero);

      var actual = lodashStable.map(falsey, function(object, index) {
        try {
          return index ? _.size(object) : _.size();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `arguments` objects', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.size(args), 3);
    });

    QUnit.test('should work with jQuery/MooTools DOM query collections', function(assert) {
      assert.expect(1);

      function Foo(elements) {
        push.apply(this, elements);
      }
      Foo.prototype = { 'length': 0, 'splice': arrayProto.splice };

      assert.strictEqual(_.size(new Foo(array)), 3);
    });

    QUnit.test('should work with maps', function(assert) {
      assert.expect(2);

      if (Map) {
        lodashStable.each([new Map, realm.map], function(map) {
          map.set('a', 1);
          map.set('b', 2);
          assert.strictEqual(_.size(map), 2);
          map.clear();
        });
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should work with sets', function(assert) {
      assert.expect(2);

      if (Set) {
        lodashStable.each([new Set, realm.set], function(set) {
          set.add(1);
          set.add(2);
          assert.strictEqual(_.size(set), 2);
          set.clear();
        });
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should not treat objects with negative lengths as array-like', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.size({ 'length': -1 }), 1);
    });

    QUnit.test('should not treat objects with lengths larger than `MAX_SAFE_INTEGER` as array-like', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.size({ 'length': MAX_SAFE_INTEGER + 1 }), 1);
    });

    QUnit.test('should not treat objects with non-number lengths as array-like', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.size({ 'length': '0' }), 1);
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.slice');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should use a default `start` of `0` and a default `end` of `length`', function(assert) {
      assert.expect(2);

      var actual = _.slice(array);
      assert.deepEqual(actual, array);
      assert.notStrictEqual(actual, array);
    });

    QUnit.test('should work with a positive `start`', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.slice(array, 1), [2, 3]);
      assert.deepEqual(_.slice(array, 1, 3), [2, 3]);
    });

    QUnit.test('should work with a `start` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(start) {
        assert.deepEqual(_.slice(array, start), []);
      });
    });

    QUnit.test('should treat falsey `start` values as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, lodashStable.constant(array));

      var actual = lodashStable.map(falsey, function(start) {
        return _.slice(array, start);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with a negative `start`', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.slice(array, -1), [3]);
    });

    QUnit.test('should work with a negative `start` <= negative `length`', function(assert) {
      assert.expect(3);

      lodashStable.each([-3, -4, -Infinity], function(start) {
        assert.deepEqual(_.slice(array, start), array);
      });
    });

    QUnit.test('should work with `start` >= `end`', function(assert) {
      assert.expect(2);

      lodashStable.each([2, 3], function(start) {
        assert.deepEqual(_.slice(array, start, 2), []);
      });
    });

    QUnit.test('should work with a positive `end`', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.slice(array, 0, 1), [1]);
    });

    QUnit.test('should work with a `end` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(end) {
        assert.deepEqual(_.slice(array, 0, end), array);
      });
    });

    QUnit.test('should treat falsey `end` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? array : [];
      });

      var actual = lodashStable.map(falsey, function(end, index) {
        return index ? _.slice(array, 0, end) : _.slice(array, 0);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with a negative `end`', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.slice(array, 0, -1), [1, 2]);
    });

    QUnit.test('should work with a negative `end` <= negative `length`', function(assert) {
      assert.expect(3);

      lodashStable.each([-3, -4, -Infinity], function(end) {
        assert.deepEqual(_.slice(array, 0, end), []);
      });
    });

    QUnit.test('should coerce `start` and `end` to integers', function(assert) {
      assert.expect(1);

      var positions = [[0.1, 1.6], ['0', 1], [0, '1'], ['1'], [NaN, 1], [1, NaN]];

      var actual = lodashStable.map(positions, function(pos) {
        return _.slice.apply(_, [array].concat(pos));
      });

      assert.deepEqual(actual, [[1], [1], [1], [2, 3], [1], []]);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(2);

      var array = [[1], [2, 3]],
          actual = lodashStable.map(array, _.slice);

      assert.deepEqual(actual, array);
      assert.notStrictEqual(actual, array);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(38);

      if (!isNpm) {
        var array = lodashStable.range(1, LARGE_ARRAY_SIZE + 1),
            length = array.length,
            wrapped = _(array);

        lodashStable.each(['map', 'filter'], function(methodName) {
          assert.deepEqual(wrapped[methodName]().slice(0, -1).value(), array.slice(0, -1));
          assert.deepEqual(wrapped[methodName]().slice(1).value(), array.slice(1));
          assert.deepEqual(wrapped[methodName]().slice(1, 3).value(), array.slice(1, 3));
          assert.deepEqual(wrapped[methodName]().slice(-1).value(), array.slice(-1));

          assert.deepEqual(wrapped[methodName]().slice(length).value(), array.slice(length));
          assert.deepEqual(wrapped[methodName]().slice(3, 2).value(), array.slice(3, 2));
          assert.deepEqual(wrapped[methodName]().slice(0, -length).value(), array.slice(0, -length));
          assert.deepEqual(wrapped[methodName]().slice(0, null).value(), array.slice(0, null));

          assert.deepEqual(wrapped[methodName]().slice(0, length).value(), array.slice(0, length));
          assert.deepEqual(wrapped[methodName]().slice(-length).value(), array.slice(-length));
          assert.deepEqual(wrapped[methodName]().slice(null).value(), array.slice(null));

          assert.deepEqual(wrapped[methodName]().slice(0, 1).value(), array.slice(0, 1));
          assert.deepEqual(wrapped[methodName]().slice(NaN, '1').value(), array.slice(NaN, '1'));

          assert.deepEqual(wrapped[methodName]().slice(0.1, 1.1).value(), array.slice(0.1, 1.1));
          assert.deepEqual(wrapped[methodName]().slice('0', 1).value(), array.slice('0', 1));
          assert.deepEqual(wrapped[methodName]().slice(0, '1').value(), array.slice(0, '1'));
          assert.deepEqual(wrapped[methodName]().slice('1').value(), array.slice('1'));
          assert.deepEqual(wrapped[methodName]().slice(NaN, 1).value(), array.slice(NaN, 1));
          assert.deepEqual(wrapped[methodName]().slice(1, NaN).value(), array.slice(1, NaN));
        });
      }
      else {
        skipAssert(assert, 38);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.some');

  (function() {
    QUnit.test('should return `true` if `predicate` returns truthy for any element', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.some([false, 1, ''], identity), true);
      assert.strictEqual(_.some([null, 'a', 0], identity), true);
    });

    QUnit.test('should return `false` for empty collections', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, stubFalse);

      var actual = lodashStable.map(empties, function(value) {
        try {
          return _.some(value, identity);
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return `true` as soon as `predicate` returns truthy', function(assert) {
      assert.expect(2);

      var count = 0;

      assert.strictEqual(_.some([null, true, null], function(value) {
        count++;
        return value;
      }), true);

      assert.strictEqual(count, 2);
    });

    QUnit.test('should return `false` if `predicate` returns falsey for all elements', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.some([false, false, false], identity), false);
      assert.strictEqual(_.some([null, 0, ''], identity), false);
    });

    QUnit.test('should use `_.identity` when `predicate` is nullish', function(assert) {
      assert.expect(2);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value, index) {
        var array = [0, 0];
        return index ? _.some(array, value) : _.some(array);
      });

      assert.deepEqual(actual, expected);

      expected = lodashStable.map(values, stubTrue);
      actual = lodashStable.map(values, function(value, index) {
        var array = [0, 1];
        return index ? _.some(array, value) : _.some(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var objects = [{ 'a': 0, 'b': 0 }, { 'a': 0, 'b': 1 }];
      assert.strictEqual(_.some(objects, 'a'), false);
      assert.strictEqual(_.some(objects, 'b'), true);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(2);

      var objects = [{ 'a': 0, 'b': 0 }, { 'a': 1, 'b': 1}];
      assert.strictEqual(_.some(objects, { 'a': 0 }), true);
      assert.strictEqual(_.some(objects, { 'b': 2 }), false);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map([[1]], _.some);
      assert.deepEqual(actual, [true]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.sortBy');

  (function() {
    var objects = [
      { 'a': 'x', 'b': 3 },
      { 'a': 'y', 'b': 4 },
      { 'a': 'x', 'b': 1 },
      { 'a': 'y', 'b': 2 }
    ];

    QUnit.test('should sort in ascending order by `iteratee`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(_.sortBy(objects, function(object) {
        return object.b;
      }), 'b');

      assert.deepEqual(actual, [1, 2, 3, 4]);
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var array = [3, 2, 1],
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([1, 2, 3]));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.sortBy(array, value) : _.sortBy(array);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(_.sortBy(objects.concat(undefined), 'b'), 'b');
      assert.deepEqual(actual, [1, 2, 3, 4, undefined]);
    });

    QUnit.test('should work with an object for `collection`', function(assert) {
      assert.expect(1);

      var actual = _.sortBy({ 'a': 1, 'b': 2, 'c': 3 }, Math.sin);
      assert.deepEqual(actual, [3, 1, 2]);
    });

    QUnit.test('should move `NaN`, nullish, and symbol values to the end', function(assert) {
      assert.expect(2);

      var symbol1 = Symbol ? Symbol('a') : null,
          symbol2 = Symbol ? Symbol('b') : null,
          array = [NaN, undefined, null, 4, symbol1, null, 1, symbol2, undefined, 3, NaN, 2],
          expected = [1, 2, 3, 4, symbol1, symbol2, null, null, undefined, undefined, NaN, NaN];

      assert.deepEqual(_.sortBy(array), expected);

      array = [NaN, undefined, symbol1, null, 'd', null, 'a', symbol2, undefined, 'c', NaN, 'b'];
      expected = ['a', 'b', 'c', 'd', symbol1, symbol2, null, null, undefined, undefined, NaN, NaN];

      assert.deepEqual(_.sortBy(array), expected);
    });

    QUnit.test('should treat number values for `collection` as empty', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.sortBy(1), []);
    });

    QUnit.test('should coerce arrays returned from `iteratee`', function(assert) {
      assert.expect(1);

      var actual = _.sortBy(objects, function(object) {
        var result = [object.a, object.b];
        result.toString = function() { return String(this[0]); };
        return result;
      });

      assert.deepEqual(actual, [objects[0], objects[2], objects[1], objects[3]]);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map([[2, 1, 3], [3, 2, 1]], _.sortBy);
      assert.deepEqual(actual, [[1, 2, 3], [1, 2, 3]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('sortBy methods');

  lodashStable.each(['orderBy', 'sortBy'], function(methodName) {
    var func = _[methodName];

    function Pair(a, b, c) {
      this.a = a;
      this.b = b;
      this.c = c;
    }

    var objects = [
      { 'a': 'x', 'b': 3 },
      { 'a': 'y', 'b': 4 },
      { 'a': 'x', 'b': 1 },
      { 'a': 'y', 'b': 2 }
    ];

    var stableArray = [
      new Pair(1, 1, 1), new Pair(1, 2, 1),
      new Pair(1, 1, 1), new Pair(1, 2, 1),
      new Pair(1, 3, 1), new Pair(1, 4, 1),
      new Pair(1, 5, 1), new Pair(1, 6, 1),
      new Pair(2, 1, 2), new Pair(2, 2, 2),
      new Pair(2, 3, 2), new Pair(2, 4, 2),
      new Pair(2, 5, 2), new Pair(2, 6, 2),
      new Pair(undefined, 1, 1), new Pair(undefined, 2, 1),
      new Pair(undefined, 3, 1), new Pair(undefined, 4, 1),
      new Pair(undefined, 5, 1), new Pair(undefined, 6, 1)
    ];

    var stableObject = lodashStable.zipObject('abcdefghijklmnopqrst'.split(''), stableArray);

    QUnit.test('`_.' + methodName + '` should sort multiple properties in ascending order', function(assert) {
      assert.expect(1);

      var actual = func(objects, ['a', 'b']);
      assert.deepEqual(actual, [objects[2], objects[0], objects[3], objects[1]]);
    });

    QUnit.test('`_.' + methodName + '` should support iteratees', function(assert) {
      assert.expect(1);

      var actual = func(objects, ['a', function(object) { return object.b; }]);
      assert.deepEqual(actual, [objects[2], objects[0], objects[3], objects[1]]);
    });

    QUnit.test('`_.' + methodName + '` should perform a stable sort (test in IE > 8 and V8)', function(assert) {
      assert.expect(2);

      lodashStable.each([stableArray, stableObject], function(value, index) {
        var actual = func(value, ['a', 'c']);
        assert.deepEqual(actual, stableArray, index ? 'object' : 'array');
      });
    });

    QUnit.test('`_.' + methodName + '` should not error on nullish elements', function(assert) {
      assert.expect(1);

      try {
        var actual = func(objects.concat(null, undefined), ['a', 'b']);
      } catch (e) {}

      assert.deepEqual(actual, [objects[2], objects[0], objects[3], objects[1], null, undefined]);
    });

    QUnit.test('`_.' + methodName + '` should work as an iteratee for methods like `_.reduce`', function(assert) {
      assert.expect(3);

      var objects = [
        { 'a': 'x', '0': 3 },
        { 'a': 'y', '0': 4 },
        { 'a': 'x', '0': 1 },
        { 'a': 'y', '0': 2 }
      ];

      var funcs = [func, lodashStable.partialRight(func, 'bogus')];

      lodashStable.each(['a', 0, [0]], function(props, index) {
        var expected = lodashStable.map(funcs, lodashStable.constant(
          index
            ? [objects[2], objects[3], objects[0], objects[1]]
            : [objects[0], objects[2], objects[1], objects[3]]
        ));

        var actual = lodashStable.map(funcs, function(func) {
          return lodashStable.reduce([props], func, objects);
        });

        assert.deepEqual(actual, expected);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('sortedIndex methods');

  lodashStable.each(['sortedIndex', 'sortedLastIndex'], function(methodName) {
    var func = _[methodName],
        isSortedIndex = methodName == 'sortedIndex';

    QUnit.test('`_.' + methodName + '` should return the insert index', function(assert) {
      assert.expect(1);

      var array = [30, 50],
          values = [30, 40, 50],
          expected = isSortedIndex ? [0, 1, 1] : [1, 1, 2];

      var actual = lodashStable.map(values, function(value) {
        return func(array, value);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with an array of strings', function(assert) {
      assert.expect(1);

      var array = ['a', 'c'],
          values = ['a', 'b', 'c'],
          expected = isSortedIndex ? [0, 1, 1] : [1, 1, 2];

      var actual = lodashStable.map(values, function(value) {
        return func(array, value);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should accept a falsey `array` argument and a `value`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, lodashStable.constant([0, 0, 0]));

      var actual = lodashStable.map(falsey, function(array) {
        return [func(array, 1), func(array, undefined), func(array, NaN)];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should align with `_.sortBy`', function(assert) {
      assert.expect(12);

      var symbol1 = Symbol ? Symbol('a') : null,
          symbol2 = Symbol ? Symbol('b') : null,
          symbol3 = Symbol ? Symbol('c') : null,
          expected = [1, '2', {}, symbol1, symbol2, null, undefined, NaN, NaN];

      lodashStable.each([
        [NaN, symbol1, null, 1, '2', {}, symbol2, NaN, undefined],
        ['2', null, 1, symbol1, NaN, {}, NaN, symbol2, undefined]
      ], function(array) {
        assert.deepEqual(_.sortBy(array), expected);
        assert.strictEqual(func(expected, 3), 2);
        assert.strictEqual(func(expected, symbol3), isSortedIndex ? 3 : (Symbol ? 5 : 6));
        assert.strictEqual(func(expected, null), isSortedIndex ? (Symbol ? 5 : 3) : 6);
        assert.strictEqual(func(expected, undefined), isSortedIndex ? 6 : 7);
        assert.strictEqual(func(expected, NaN), isSortedIndex ? 7 : 9);
      });
    });

    QUnit.test('`_.' + methodName + '` should align with `_.sortBy` for nulls', function(assert) {
      assert.expect(3);

      var array = [null, null];

      assert.strictEqual(func(array, null), isSortedIndex ? 0 : 2);
      assert.strictEqual(func(array, 1), 0);
      assert.strictEqual(func(array, 'a'), 0);
    });

    QUnit.test('`_.' + methodName + '` should align with `_.sortBy` for symbols', function(assert) {
      assert.expect(3);

      var symbol1 = Symbol ? Symbol('a') : null,
          symbol2 = Symbol ? Symbol('b') : null,
          symbol3 = Symbol ? Symbol('c') : null,
          array = [symbol1, symbol2];

      assert.strictEqual(func(array, symbol3), isSortedIndex ? 0 : 2);
      assert.strictEqual(func(array, 1), 0);
      assert.strictEqual(func(array, 'a'), 0);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('sortedIndexBy methods');

  lodashStable.each(['sortedIndexBy', 'sortedLastIndexBy'], function(methodName) {
    var func = _[methodName],
        isSortedIndexBy = methodName == 'sortedIndexBy';

    QUnit.test('`_.' + methodName + '` should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      func([30, 50], 40, function(assert) {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [40]);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 30 }, { 'x': 50 }],
          actual = func(objects, { 'x': 40 }, 'x');

      assert.strictEqual(actual, 1);
    });

    QUnit.test('`_.' + methodName + '` should support arrays larger than `MAX_ARRAY_LENGTH / 2`', function(assert) {
      assert.expect(12);

      lodashStable.each([Math.ceil(MAX_ARRAY_LENGTH / 2), MAX_ARRAY_LENGTH], function(length) {
        var array = [],
            values = [MAX_ARRAY_LENGTH, NaN, undefined];

        array.length = length;

        lodashStable.each(values, function(value) {
          var steps = 0;

          var actual = func(array, value, function(value) {
            steps++;
            return value;
          });

          var expected = (isSortedIndexBy ? !lodashStable.isNaN(value) : lodashStable.isFinite(value))
            ? 0
            : Math.min(length, MAX_ARRAY_INDEX);

          // Avoid false fails in older Firefox.
          if (array.length == length) {
            assert.ok(steps == 32 || steps == 33);
            assert.strictEqual(actual, expected);
          }
          else {
            skipAssert(assert, 2);
          }
        });
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('sortedIndexOf methods');

  lodashStable.each(['sortedIndexOf', 'sortedLastIndexOf'], function(methodName) {
    var func = _[methodName],
        isSortedIndexOf = methodName == 'sortedIndexOf';

    QUnit.test('`_.' + methodName + '` should perform a binary search', function(assert) {
      assert.expect(1);

      var sorted = [4, 4, 5, 5, 6, 6];
      assert.deepEqual(func(sorted, 5), isSortedIndexOf ? 2 : 3);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.sortedUniq');

  (function() {
    QUnit.test('should return unique values of a sorted array', function(assert) {
      assert.expect(3);

      var expected = [1, 2, 3];

      lodashStable.each([[1, 2, 3], [1, 1, 2, 2, 3], [1, 2, 3, 3, 3, 3, 3]], function(array) {
        assert.deepEqual(_.sortedUniq(array), expected);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.split');

  (function() {
    QUnit.test('should split a string by `separator`', function(assert) {
      assert.expect(3);

      var string = 'abcde';
      assert.deepEqual(_.split(string, 'c'), ['ab', 'de']);
      assert.deepEqual(_.split(string, /[bd]/), ['a', 'c', 'e']);
      assert.deepEqual(_.split(string, '', 2), ['a', 'b']);
    });

    QUnit.test('should return an array containing an empty string for empty values', function(assert) {
      assert.expect(1);

      var values = [, null, undefined, ''],
          expected = lodashStable.map(values, lodashStable.constant(['']));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.split(value) : _.split();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var strings = ['abc', 'def', 'ghi'],
          actual = lodashStable.map(strings, _.split);

      assert.deepEqual(actual, [['abc'], ['def'], ['ghi']]);
    });

    QUnit.test('should allow mixed string and array prototype methods', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _('abc');
        assert.strictEqual(wrapped.split('b').join(','), 'a,c');
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.spread');

  (function() {
    function fn(a, b, c) {
      return slice.call(arguments);
    }

    QUnit.test('should spread arguments to `func`', function(assert) {
      assert.expect(1);

      var spread = _.spread(fn);
      assert.deepEqual(spread([4, 2]), [4, 2]);
    });

    QUnit.test('should accept a falsey `array` argument', function(assert) {
      assert.expect(1);

      var spread = _.spread(stubTrue),
          expected = lodashStable.map(falsey, stubTrue);

      var actual = lodashStable.map(falsey, function(array, index) {
        try {
          return index ? spread(array) : spread();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should provide correct `func` arguments', function(assert) {
      assert.expect(1);

      var args;

      var spread = _.spread(function() {
        args = slice.call(arguments);
      });

      spread([4, 2], 'ignored');
      assert.deepEqual(args, [4, 2]);
    });

    QUnit.test('should work with `start`', function(assert) {
      assert.expect(1);

      var spread = _.spread(fn, 1);
      assert.deepEqual(spread(1, [2, 3, 4]), [1, 2, 3, 4]);
    });

    QUnit.test('should treat `start` as `0` for negative or `NaN` values', function(assert) {
      assert.expect(1);

      var values = [-1, NaN, 'a'],
          expected = lodashStable.map(values, lodashStable.constant([1, 2, 3, 4]));

      var actual = lodashStable.map(values, function(value) {
        var spread = _.spread(fn, value);
        return spread([1, 2, 3, 4]);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should coerce `start` to an integer', function(assert) {
      assert.expect(1);

      var spread = _.spread(fn, 1.6);
      assert.deepEqual(spread(1, [2, 3]), [1, 2, 3]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.startCase');

  (function() {
    QUnit.test('should uppercase only the first character of each word', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.startCase('--foo-bar--'), 'Foo Bar');
      assert.strictEqual(_.startCase('fooBar'), 'Foo Bar');
      assert.strictEqual(_.startCase('__FOO_BAR__'), 'FOO BAR');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.startsWith');

  (function() {
    var string = 'abc';

    QUnit.test('should return `true` if a string starts with `target`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.startsWith(string, 'a'), true);
    });

    QUnit.test('should return `false` if a string does not start with `target`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.startsWith(string, 'b'), false);
    });

    QUnit.test('should work with a `position` argument', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.startsWith(string, 'b', 1), true);
    });

    QUnit.test('should work with `position` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 5, MAX_SAFE_INTEGER, Infinity], function(position) {
        assert.strictEqual(_.startsWith(string, 'a', position), false);
      });
    });

    QUnit.test('should treat falsey `position` values as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubTrue);

      var actual = lodashStable.map(falsey, function(position) {
        return _.startsWith(string, 'a', position);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should treat a negative `position` as `0`', function(assert) {
      assert.expect(6);

      lodashStable.each([-1, -3, -Infinity], function(position) {
        assert.strictEqual(_.startsWith(string, 'a', position), true);
        assert.strictEqual(_.startsWith(string, 'b', position), false);
      });
    });

    QUnit.test('should coerce `position` to an integer', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.startsWith(string, 'bc', 1.2), true);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.startsWith and lodash.endsWith');

  lodashStable.each(['startsWith', 'endsWith'], function(methodName) {
    var func = _[methodName],
        isStartsWith = methodName == 'startsWith';

    var string = 'abc',
        chr = isStartsWith ? 'a' : 'c';

    QUnit.test('`_.' + methodName + '` should coerce `string` to a string', function(assert) {
      assert.expect(2);

      assert.strictEqual(func(Object(string), chr), true);
      assert.strictEqual(func({ 'toString': lodashStable.constant(string) }, chr), true);
    });

    QUnit.test('`_.' + methodName + '` should coerce `target` to a string', function(assert) {
      assert.expect(2);

      assert.strictEqual(func(string, Object(chr)), true);
      assert.strictEqual(func(string, { 'toString': lodashStable.constant(chr) }), true);
    });

    QUnit.test('`_.' + methodName + '` should coerce `position` to a number', function(assert) {
      assert.expect(2);

      var position = isStartsWith ? 1 : 2;

      assert.strictEqual(func(string, 'b', Object(position)), true);
      assert.strictEqual(func(string, 'b', { 'toString': lodashStable.constant(String(position)) }), true);
    });

    QUnit.test('should return `true` when `target` is an empty string regardless of `position`', function(assert) {
      assert.expect(1);

      var positions = [-Infinity, NaN, -3, -1, 0, 1, 2, 3, 5, MAX_SAFE_INTEGER, Infinity];

      assert.ok(lodashStable.every(positions, function(position) {
        return func(string, '', position);
      }));
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('stub methods');

  lodashStable.each(['noop', 'stubTrue', 'stubFalse', 'stubArray', 'stubObject', 'stubString'], function(methodName) {
    var func = _[methodName];

    var pair = ({
      'stubArray': [[], 'an empty array'],
      'stubFalse': [false, '`false`'],
      'stubObject': [{}, 'an empty object'],
      'stubString': ['', 'an empty string'],
      'stubTrue': [true, '`true`'],
      'noop': [undefined, '`undefined`']
    })[methodName];

    var values = Array(2).concat(empties, true, 1, 'a'),
        expected = lodashStable.map(values, lodashStable.constant(pair[0]));

    QUnit.test('`_.' + methodName + '` should return ' + pair[1], function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(values, function(value, index) {
        if (index < 2) {
          return index ? func.call({}) : func();
        }
        return func(value);
      });

      assert.deepEqual(actual, expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.subtract');

  (function() {
    QUnit.test('should subtract two numbers', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.subtract(6, 4), 2);
      assert.strictEqual(_.subtract(-6, 4), -10);
      assert.strictEqual(_.subtract(-6, -4), -2);
    });

    QUnit.test('should coerce arguments to numbers', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.subtract('6', '4'), 2);
      assert.deepEqual(_.subtract('x', 'y'), NaN);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('math operator methods');

  lodashStable.each(['add', 'divide', 'multiply', 'subtract'], function(methodName) {
    var func = _[methodName],
        isAddSub = methodName == 'add' || methodName == 'subtract';

    QUnit.test('`_.' + methodName + '` should return `' + (isAddSub ? 0 : 1) + '` when no arguments are given', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(), isAddSub ? 0 : 1);
    });

    QUnit.test('`_.' + methodName + '` should work with only one defined argument', function(assert) {
      assert.expect(3);

      assert.strictEqual(func(6), 6);
      assert.strictEqual(func(6, undefined), 6);
      assert.strictEqual(func(undefined, 4), 4);
    });

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(2);

      var values = [0, '0', -0, '-0'],
          expected = [[0, Infinity], ['0', Infinity], [-0, -Infinity], ['-0', -Infinity]];

      lodashStable.times(2, function(index) {
        var actual = lodashStable.map(values, function(value) {
          var result = index ? func(undefined, value) : func(value);
          return [result, 1 / result];
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should convert objects to `NaN`', function(assert) {
      assert.expect(2);

      assert.deepEqual(func(0, {}), NaN);
      assert.deepEqual(func({}, 0), NaN);
    });

    QUnit.test('`_.' + methodName + '` should convert symbols to `NaN`', function(assert) {
      assert.expect(2);

      if (Symbol) {
        assert.deepEqual(func(0, symbol), NaN);
        assert.deepEqual(func(symbol, 0), NaN);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('`_.' + methodName + '` should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var actual = _(1)[methodName](2);
        assert.notOk(actual instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var actual = _(1).chain()[methodName](2);
        assert.ok(actual instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.sumBy');

  (function() {
    var array = [6, 4, 2],
        objects = [{ 'a': 2 }, { 'a': 3 }, { 'a': 1 }];

    QUnit.test('should work with an `iteratee` argument', function(assert) {
      assert.expect(1);

      var actual = _.sumBy(objects, function(object) {
        return object.a;
      });

      assert.deepEqual(actual, 6);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.sumBy(array, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [6]);
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var arrays = [[2], [3], [1]];
      assert.strictEqual(_.sumBy(arrays, 0), 6);
      assert.strictEqual(_.sumBy(objects, 'a'), 6);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('sum methods');

  lodashStable.each(['sum', 'sumBy'], function(methodName) {
    var array = [6, 4, 2],
        func = _[methodName];

    QUnit.test('`_.' + methodName + '` should return the sum of an array of numbers', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(array), 12);
    });

    QUnit.test('`_.' + methodName + '` should return `0` when passing empty `array` values', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(empties, stubZero);

      var actual = lodashStable.map(empties, function(value) {
        return func(value);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should skip `undefined` values', function(assert) {
      assert.expect(1);

      assert.strictEqual(func([1, undefined]), 1);
    });

    QUnit.test('`_.' + methodName + '` should not skip `NaN` values', function(assert) {
      assert.expect(1);

      assert.deepEqual(func([1, NaN]), NaN);
    });

    QUnit.test('`_.' + methodName + '` should not coerce values to numbers', function(assert) {
      assert.expect(1);

      assert.strictEqual(func(['1', '2']), '12');
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.tail');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should accept a falsey `array` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubArray);

      var actual = lodashStable.map(falsey, function(array, index) {
        try {
          return index ? _.tail(array) : _.tail();
        } catch (e) {}
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should exclude the first element', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.tail(array), [2, 3]);
    });

    QUnit.test('should return an empty when querying empty arrays', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.tail([]), []);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.tail);

      assert.deepEqual(actual, [[2, 3], [5, 6], [8, 9]]);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            values = [];

        var actual = _(array).tail().filter(function(value) {
          values.push(value);
          return false;
        })
        .value();

        assert.deepEqual(actual, []);
        assert.deepEqual(values, array.slice(1));

        values = [];

        actual = _(array).filter(function(value) {
          values.push(value);
          return isEven(value);
        })
        .tail()
        .value();

        assert.deepEqual(actual, _.tail(_.filter(array, isEven)));
        assert.deepEqual(values, array);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should not execute subsequent iteratees on an empty array in a lazy sequence', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            iteratee = function() { pass = false; },
            pass = true,
            actual = _(array).slice(0, 1).tail().map(iteratee).value();

        assert.ok(pass);
        assert.deepEqual(actual, []);

        pass = true;
        actual = _(array).filter().slice(0, 1).tail().map(iteratee).value();

        assert.ok(pass);
        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 4);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.take');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should take the first two elements', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.take(array, 2), [1, 2]);
    });

    QUnit.test('should treat falsey `n` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? [1] : [];
      });

      var actual = lodashStable.map(falsey, function(n) {
        return _.take(array, n);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an empty array when `n` < `1`', function(assert) {
      assert.expect(3);

      lodashStable.each([0, -1, -Infinity], function(n) {
        assert.deepEqual(_.take(array, n), []);
      });
    });

    QUnit.test('should return all elements when `n` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(n) {
        assert.deepEqual(_.take(array, n), array);
      });
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.take);

      assert.deepEqual(actual, [[1], [4], [7]]);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        var array = lodashStable.range(1, LARGE_ARRAY_SIZE + 1),
            predicate = function(value) { values.push(value); return isEven(value); },
            values = [],
            actual = _(array).take(2).take().value();

        assert.deepEqual(actual, _.take(_.take(array, 2)));

        actual = _(array).filter(predicate).take(2).take().value();
        assert.deepEqual(values, [1, 2]);
        assert.deepEqual(actual, _.take(_.take(_.filter(array, predicate), 2)));

        actual = _(array).take(6).takeRight(4).take(2).takeRight().value();
        assert.deepEqual(actual, _.takeRight(_.take(_.takeRight(_.take(array, 6), 4), 2)));

        values = [];

        actual = _(array).take(array.length - 1).filter(predicate).take(6).takeRight(4).take(2).takeRight().value();
        assert.deepEqual(values, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        assert.deepEqual(actual, _.takeRight(_.take(_.takeRight(_.take(_.filter(_.take(array, array.length - 1), predicate), 6), 4), 2)));
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.takeRight');

  (function() {
    var array = [1, 2, 3];

    QUnit.test('should take the last two elements', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.takeRight(array, 2), [2, 3]);
    });

    QUnit.test('should treat falsey `n` values, except `undefined`, as `0`', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, function(value) {
        return value === undefined ? [3] : [];
      });

      var actual = lodashStable.map(falsey, function(n) {
        return _.takeRight(array, n);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an empty array when `n` < `1`', function(assert) {
      assert.expect(3);

      lodashStable.each([0, -1, -Infinity], function(n) {
        assert.deepEqual(_.takeRight(array, n), []);
      });
    });

    QUnit.test('should return all elements when `n` >= `length`', function(assert) {
      assert.expect(4);

      lodashStable.each([3, 4, Math.pow(2, 32), Infinity], function(n) {
        assert.deepEqual(_.takeRight(array, n), array);
      });
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
          actual = lodashStable.map(array, _.takeRight);

      assert.deepEqual(actual, [[3], [6], [9]]);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(6);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            predicate = function(value) { values.push(value); return isEven(value); },
            values = [],
            actual = _(array).takeRight(2).takeRight().value();

        assert.deepEqual(actual, _.takeRight(_.takeRight(array)));

        actual = _(array).filter(predicate).takeRight(2).takeRight().value();
        assert.deepEqual(values, array);
        assert.deepEqual(actual, _.takeRight(_.takeRight(_.filter(array, predicate), 2)));

        actual = _(array).takeRight(6).take(4).takeRight(2).take().value();
        assert.deepEqual(actual, _.take(_.takeRight(_.take(_.takeRight(array, 6), 4), 2)));

        values = [];

        actual = _(array).filter(predicate).takeRight(6).take(4).takeRight(2).take().value();
        assert.deepEqual(values, array);
        assert.deepEqual(actual, _.take(_.takeRight(_.take(_.takeRight(_.filter(array, predicate), 6), 4), 2)));
      }
      else {
        skipAssert(assert, 6);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.takeRightWhile');

  (function() {
    var array = [1, 2, 3, 4];

    var objects = [
      { 'a': 0, 'b': 0 },
      { 'a': 1, 'b': 1 },
      { 'a': 2, 'b': 2 }
    ];

    QUnit.test('should take elements while `predicate` returns truthy', function(assert) {
      assert.expect(1);

      var actual = _.takeRightWhile(array, function(n) {
        return n > 2;
      });

      assert.deepEqual(actual, [3, 4]);
    });

    QUnit.test('should provide correct `predicate` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.takeRightWhile(array, function() {
        args = slice.call(arguments);
      });

      assert.deepEqual(args, [4, 3, array]);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.takeRightWhile(objects, { 'b': 2 }), objects.slice(2));
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.takeRightWhile(objects, ['b', 2]), objects.slice(2));
    });

    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.takeRightWhile(objects, 'b'), objects.slice(1));
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(3);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            predicate = function(n) { return n > 2; },
            expected = _.takeRightWhile(array, predicate),
            wrapped = _(array).takeRightWhile(predicate);

        assert.deepEqual(wrapped.value(), expected);
        assert.deepEqual(wrapped.reverse().value(), expected.slice().reverse());
        assert.strictEqual(wrapped.last(), _.last(expected));
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should provide correct `predicate` arguments in a lazy sequence', function(assert) {
      assert.expect(5);

      if (!isNpm) {
        var args,
            array = lodashStable.range(LARGE_ARRAY_SIZE + 1);

        var expected = [
          square(LARGE_ARRAY_SIZE),
          LARGE_ARRAY_SIZE - 1,
          lodashStable.map(array.slice(1), square)
        ];

        _(array).slice(1).takeRightWhile(function(value, index, array) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, [LARGE_ARRAY_SIZE, LARGE_ARRAY_SIZE - 1, array.slice(1)]);

        _(array).slice(1).map(square).takeRightWhile(function(value, index, array) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, expected);

        _(array).slice(1).map(square).takeRightWhile(function(value, index) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, expected);

        _(array).slice(1).map(square).takeRightWhile(function(index) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, [square(LARGE_ARRAY_SIZE)]);

        _(array).slice(1).map(square).takeRightWhile(function() {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, expected);
      }
      else {
        skipAssert(assert, 5);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.takeWhile');

  (function() {
    var array = [1, 2, 3, 4];

    var objects = [
      { 'a': 2, 'b': 2 },
      { 'a': 1, 'b': 1 },
      { 'a': 0, 'b': 0 }
    ];

    QUnit.test('should take elements while `predicate` returns truthy', function(assert) {
      assert.expect(1);

      var actual = _.takeWhile(array, function(n) {
        return n < 3;
      });

      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('should provide correct `predicate` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.takeWhile(array, function() {
        args = slice.call(arguments);
      });

      assert.deepEqual(args, [1, 0, array]);
    });

    QUnit.test('should work with `_.matches` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.takeWhile(objects, { 'b': 2 }), objects.slice(0, 1));
    });

    QUnit.test('should work with `_.matchesProperty` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.takeWhile(objects, ['b', 2]), objects.slice(0, 1));
    });
    QUnit.test('should work with `_.property` shorthands', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.takeWhile(objects, 'b'), objects.slice(0, 2));
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(3);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            predicate = function(n) { return n < 3; },
            expected = _.takeWhile(array, predicate),
            wrapped = _(array).takeWhile(predicate);

        assert.deepEqual(wrapped.value(), expected);
        assert.deepEqual(wrapped.reverse().value(), expected.slice().reverse());
        assert.strictEqual(wrapped.last(), _.last(expected));
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should work in a lazy sequence with `take`', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE);

        var actual = _(array)
          .takeWhile(function(n) { return n < 4; })
          .take(2)
          .takeWhile(function(n) { return n == 0; })
          .value();

        assert.deepEqual(actual, [0]);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should provide correct `predicate` arguments in a lazy sequence', function(assert) {
      assert.expect(5);

      if (!isNpm) {
        var args,
            array = lodashStable.range(LARGE_ARRAY_SIZE + 1),
            expected = [1, 0, lodashStable.map(array.slice(1), square)];

        _(array).slice(1).takeWhile(function(value, index, array) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, [1, 0, array.slice(1)]);

        _(array).slice(1).map(square).takeWhile(function(value, index, array) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, expected);

        _(array).slice(1).map(square).takeWhile(function(value, index) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, expected);

        _(array).slice(1).map(square).takeWhile(function(value) {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, [1]);

        _(array).slice(1).map(square).takeWhile(function() {
          args = slice.call(arguments);
        }).value();

        assert.deepEqual(args, expected);
      }
      else {
        skipAssert(assert, 5);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.tap');

  (function() {
    QUnit.test('should intercept and return the given value', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var intercepted,
            array = [1, 2, 3];

        var actual = _.tap(array, function(value) {
          intercepted = value;
        });

        assert.strictEqual(actual, array);
        assert.strictEqual(intercepted, array);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should intercept unwrapped values and return wrapped values when chaining', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var intercepted,
            array = [1, 2, 3];

        var wrapped = _(array).tap(function(value) {
          intercepted = value;
          value.pop();
        });

        assert.ok(wrapped instanceof _);

        wrapped.value();
        assert.strictEqual(intercepted, array);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.template');

  (function() {
    QUnit.test('should escape values in "escape" delimiters', function(assert) {
      assert.expect(1);

      var strings = ['<p><%- value %></p>', '<p><%-value%></p>', '<p><%-\nvalue\n%></p>'],
          expected = lodashStable.map(strings, lodashStable.constant('<p>&amp;&lt;&gt;&quot;&#39;&#96;\/</p>')),
          data = { 'value': '&<>"\'`\/' };

      var actual = lodashStable.map(strings, function(string) {
        return _.template(string)(data);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not reference `_.escape` when "escape" delimiters are not used', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= typeof __e %>');
      assert.strictEqual(compiled({}), 'undefined');
    });

    QUnit.test('should evaluate JavaScript in "evaluate" delimiters', function(assert) {
      assert.expect(1);

      var compiled = _.template(
        '<ul><%\
        for (var key in collection) {\
          %><li><%= collection[key] %></li><%\
        } %></ul>'
      );

      var data = { 'collection': { 'a': 'A', 'b': 'B' } },
          actual = compiled(data);

      assert.strictEqual(actual, '<ul><li>A</li><li>B</li></ul>');
    });

    QUnit.test('should support "evaluate" delimiters with single line comments (test production builds)', function(assert) {
      assert.expect(1);

      var compiled = _.template('<% // A code comment. %><% if (value) { %>yap<% } else { %>nope<% } %>'),
          data = { 'value': true };

      assert.strictEqual(compiled(data), 'yap');
    });

    QUnit.test('should support referencing variables declared in "evaluate" delimiters from other delimiters', function(assert) {
      assert.expect(1);

      var compiled = _.template('<% var b = a; %><%= b.value %>'),
          data = { 'a': { 'value': 1 } };

      assert.strictEqual(compiled(data), '1');
    });

    QUnit.test('should interpolate data properties in "interpolate" delimiters', function(assert) {
      assert.expect(1);

      var strings = ['<%= a %>BC', '<%=a%>BC', '<%=\na\n%>BC'],
          expected = lodashStable.map(strings, lodashStable.constant('ABC')),
          data = { 'a': 'A' };

      var actual = lodashStable.map(strings, function(string) {
        return _.template(string)(data);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should support "interpolate" delimiters with escaped values', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= a ? "a=\\"A\\"" : "" %>'),
          data = { 'a': true };

      assert.strictEqual(compiled(data), 'a="A"');
    });

    QUnit.test('should support "interpolate" delimiters containing ternary operators', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= value ? value : "b" %>'),
          data = { 'value': 'a' };

      assert.strictEqual(compiled(data), 'a');
    });

    QUnit.test('should support "interpolate" delimiters containing global values', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= typeof Math.abs %>');

      try {
        var actual = compiled();
      } catch (e) {}

      assert.strictEqual(actual, 'function');
    });

    QUnit.test('should support complex "interpolate" delimiters', function(assert) {
      assert.expect(22);

      lodashStable.forOwn({
        '<%= a + b %>': '3',
        '<%= b - a %>': '1',
        '<%= a = b %>': '2',
        '<%= !a %>': 'false',
        '<%= ~a %>': '-2',
        '<%= a * b %>': '2',
        '<%= a / b %>': '0.5',
        '<%= a % b %>': '1',
        '<%= a >> b %>': '0',
        '<%= a << b %>': '4',
        '<%= a & b %>': '0',
        '<%= a ^ b %>': '3',
        '<%= a | b %>': '3',
        '<%= {}.toString.call(0) %>': numberTag,
        '<%= a.toFixed(2) %>': '1.00',
        '<%= obj["a"] %>': '1',
        '<%= delete a %>': 'true',
        '<%= "a" in obj %>': 'true',
        '<%= obj instanceof Object %>': 'true',
        '<%= new Boolean %>': 'false',
        '<%= typeof a %>': 'number',
        '<%= void a %>': ''
      },
      function(value, key) {
        var compiled = _.template(key),
            data = { 'a': 1, 'b': 2 };

        assert.strictEqual(compiled(data), value, key);
      });
    });

    QUnit.test('should support ES6 template delimiters', function(assert) {
      assert.expect(2);

      var data = { 'value': 2 };
      assert.strictEqual(_.template('1${value}3')(data), '123');
      assert.strictEqual(_.template('${"{" + value + "\\}"}')(data), '{2}');
    });

    QUnit.test('should support the "imports" option', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= a %>', { 'imports': { 'a': 1 } });
      assert.strictEqual(compiled({}), '1');
    });

    QUnit.test('should support the "variable" options', function(assert) {
      assert.expect(1);

      var compiled = _.template(
        '<% _.each( data.a, function( value ) { %>' +
            '<%= value.valueOf() %>' +
        '<% }) %>', { 'variable': 'data' }
      );

      var data = { 'a': [1, 2, 3] };

      try {
        assert.strictEqual(compiled(data), '123');
      } catch (e) {
        assert.ok(false, e.message);
      }
    });

    QUnit.test('should support custom delimiters', function(assert) {
      assert.expect(2);

      lodashStable.times(2, function(index) {
        var settingsClone = lodashStable.clone(_.templateSettings);

        var settings = lodashStable.assign(index ? _.templateSettings : {}, {
          'escape': /\{\{-([\s\S]+?)\}\}/g,
          'evaluate': /\{\{([\s\S]+?)\}\}/g,
          'interpolate': /\{\{=([\s\S]+?)\}\}/g
        });

        var expected = '<ul><li>0: a &amp; A</li><li>1: b &amp; B</li></ul>',
            compiled = _.template('<ul>{{ _.each(collection, function(value, index) {}}<li>{{= index }}: {{- value }}</li>{{}); }}</ul>', index ? null : settings),
            data = { 'collection': ['a & A', 'b & B'] };

        assert.strictEqual(compiled(data), expected);
        lodashStable.assign(_.templateSettings, settingsClone);
      });
    });

    QUnit.test('should support custom delimiters containing special characters', function(assert) {
      assert.expect(2);

      lodashStable.times(2, function(index) {
        var settingsClone = lodashStable.clone(_.templateSettings);

        var settings = lodashStable.assign(index ? _.templateSettings : {}, {
          'escape': /<\?-([\s\S]+?)\?>/g,
          'evaluate': /<\?([\s\S]+?)\?>/g,
          'interpolate': /<\?=([\s\S]+?)\?>/g
        });

        var expected = '<ul><li>0: a &amp; A</li><li>1: b &amp; B</li></ul>',
            compiled = _.template('<ul><? _.each(collection, function(value, index) { ?><li><?= index ?>: <?- value ?></li><? }); ?></ul>', index ? null : settings),
            data = { 'collection': ['a & A', 'b & B'] };

        assert.strictEqual(compiled(data), expected);
        lodashStable.assign(_.templateSettings, settingsClone);
      });
    });

    QUnit.test('should use a `with` statement by default', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= index %><%= collection[index] %><% _.each(collection, function(value, index) { %><%= index %><% }); %>'),
          actual = compiled({ 'index': 1, 'collection': ['a', 'b', 'c'] });

      assert.strictEqual(actual, '1b012');
    });

    QUnit.test('should use `_.templateSettings.imports._.templateSettings`', function(assert) {
      assert.expect(1);

      var lodash = _.templateSettings.imports._,
          settingsClone = lodashStable.clone(lodash.templateSettings);

      lodash.templateSettings = lodashStable.assign(lodash.templateSettings, {
        'interpolate': /\{\{=([\s\S]+?)\}\}/g
      });

      var compiled = _.template('{{= a }}');
      assert.strictEqual(compiled({ 'a': 1 }), '1');

      if (settingsClone) {
        lodashStable.assign(lodash.templateSettings, settingsClone);
      } else {
        delete lodash.templateSettings;
      }
    });

    QUnit.test('should fallback to `_.templateSettings`', function(assert) {
      assert.expect(1);

      var lodash = _.templateSettings.imports._,
          delimiter = _.templateSettings.interpolate;

      _.templateSettings.imports._ = { 'escape': lodashStable.escape };
      _.templateSettings.interpolate = /\{\{=([\s\S]+?)\}\}/g;

      var compiled = _.template('{{= a }}');
      assert.strictEqual(compiled({ 'a': 1 }), '1');

      _.templateSettings.imports._ = lodash;
      _.templateSettings.interpolate = delimiter;
    });

    QUnit.test('should ignore `null` delimiters', function(assert) {
      assert.expect(3);

      var delimiter = {
        'escape': /\{\{-([\s\S]+?)\}\}/g,
        'evaluate': /\{\{([\s\S]+?)\}\}/g,
        'interpolate': /\{\{=([\s\S]+?)\}\}/g
      };

      lodashStable.forOwn({
        'escape': '{{- a }}',
        'evaluate': '{{ print(a) }}',
        'interpolate': '{{= a }}'
      },
      function(value, key) {
        var settings = { 'escape': null, 'evaluate': null, 'interpolate': null };
        settings[key] = delimiter[key];

        var expected = '1 <%- a %> <% print(a) %> <%= a %>',
            compiled = _.template(value + ' <%- a %> <% print(a) %> <%= a %>', settings),
            data = { 'a': 1 };

        assert.strictEqual(compiled(data), expected);
      });
    });

    QUnit.test('should work without delimiters', function(assert) {
      assert.expect(1);

      var expected = 'abc';
      assert.strictEqual(_.template(expected)({}), expected);
    });

    QUnit.test('should work with `this` references', function(assert) {
      assert.expect(2);

      var compiled = _.template('a<%= this.String("b") %>c');
      assert.strictEqual(compiled(), 'abc');

      var object = { 'b': 'B' };
      object.compiled = _.template('A<%= this.b %>C', { 'variable': 'obj' });
      assert.strictEqual(object.compiled(), 'ABC');
    });

    QUnit.test('should work with backslashes', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= a %> \\b'),
          data = { 'a': 'A' };

      assert.strictEqual(compiled(data), 'A \\b');
    });

    QUnit.test('should work with escaped characters in string literals', function(assert) {
      assert.expect(2);

      var compiled = _.template('<% print("\'\\n\\r\\t\\u2028\\u2029\\\\") %>');
      assert.strictEqual(compiled(), "'\n\r\t\u2028\u2029\\");

      var data = { 'a': 'A' };
      compiled = _.template('\'\n\r\t<%= a %>\u2028\u2029\\"');
      assert.strictEqual(compiled(data), '\'\n\r\tA\u2028\u2029\\"');
    });

    QUnit.test('should handle \\u2028 & \\u2029 characters', function(assert) {
      assert.expect(1);

      var compiled = _.template('\u2028<%= "\\u2028\\u2029" %>\u2029');
      assert.strictEqual(compiled(), '\u2028\u2028\u2029\u2029');
    });

    QUnit.test('should work with statements containing quotes', function(assert) {
      assert.expect(1);

      var compiled = _.template("<%\
        if (a == 'A' || a == \"a\") {\
          %>'a',\"A\"<%\
        } %>"
      );

      var data = { 'a': 'A' };
      assert.strictEqual(compiled(data), "'a',\"A\"");
    });

    QUnit.test('should work with templates containing newlines and comments', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%\n\
        // A code comment.\n\
        if (value) { value += 3; }\n\
        %><p><%= value %></p>'
      );

      assert.strictEqual(compiled({ 'value': 3 }), '<p>6</p>');
    });

    QUnit.test('should not error with IE conditional comments enabled (test with development build)', function(assert) {
      assert.expect(1);

      var compiled = _.template(''),
          pass = true;

      /*@cc_on @*/
      try {
        compiled();
      } catch (e) {
        pass = false;
      }
      assert.ok(pass);
    });

    QUnit.test('should tokenize delimiters', function(assert) {
      assert.expect(1);

      var compiled = _.template('<span class="icon-<%= type %>2"></span>'),
          data = { 'type': 1 };

      assert.strictEqual(compiled(data), '<span class="icon-12"></span>');
    });

    QUnit.test('should evaluate delimiters once', function(assert) {
      assert.expect(1);

      var actual = [],
          compiled = _.template('<%= func("a") %><%- func("b") %><% func("c") %>'),
          data = { 'func': function(value) { actual.push(value); } };

      compiled(data);
      assert.deepEqual(actual, ['a', 'b', 'c']);
    });

    QUnit.test('should match delimiters before escaping text', function(assert) {
      assert.expect(1);

      var compiled = _.template('<<\n a \n>>', { 'evaluate': /<<(.*?)>>/g });
      assert.strictEqual(compiled(), '<<\n a \n>>');
    });

    QUnit.test('should resolve nullish values to an empty string', function(assert) {
      assert.expect(3);

      var compiled = _.template('<%= a %><%- a %>'),
          data = { 'a': null };

      assert.strictEqual(compiled(data), '');

      data = { 'a': undefined };
      assert.strictEqual(compiled(data), '');

      data = { 'a': {} };
      compiled = _.template('<%= a.b %><%- a.b %>');
      assert.strictEqual(compiled(data), '');
    });

    QUnit.test('should return an empty string for empty values', function(assert) {
      assert.expect(1);

      var values = [, null, undefined, ''],
          expected = lodashStable.map(values, stubString),
          data = { 'a': 1 };

      var actual = lodashStable.map(values, function(value, index) {
        var compiled = index ? _.template(value) : _.template();
        return compiled(data);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should parse delimiters without newlines', function(assert) {
      assert.expect(1);

      var expected = '<<\nprint("<p>" + (value ? "yes" : "no") + "</p>")\n>>',
          compiled = _.template(expected, { 'evaluate': /<<(.+?)>>/g }),
          data = { 'value': true };

      assert.strictEqual(compiled(data), expected);
    });

    QUnit.test('should support recursive calls', function(assert) {
      assert.expect(1);

      var compiled = _.template('<%= a %><% a = _.template(c)(obj) %><%= a %>'),
          data = { 'a': 'A', 'b': 'B', 'c': '<%= b %>' };

      assert.strictEqual(compiled(data), 'AB');
    });

    QUnit.test('should coerce `text` argument to a string', function(assert) {
      assert.expect(1);

      var object = { 'toString': lodashStable.constant('<%= a %>') },
          data = { 'a': 1 };

      assert.strictEqual(_.template(object)(data), '1');
    });

    QUnit.test('should not modify the `options` object', function(assert) {
      assert.expect(1);

      var options = {};
      _.template('', options);
      assert.deepEqual(options, {});
    });

    QUnit.test('should not modify `_.templateSettings` when `options` are given', function(assert) {
      assert.expect(2);

      var data = { 'a': 1 };

      assert.notOk('a' in _.templateSettings);
      _.template('', {}, data);
      assert.notOk('a' in _.templateSettings);

      delete _.templateSettings.a;
    });

    QUnit.test('should not error for non-object `data` and `options` values', function(assert) {
      assert.expect(2);

      var pass = true;

      try {
        _.template('')(1);
      } catch (e) {
        pass = false;
      }
      assert.ok(pass, '`data` value');

      pass = true;

      try {
        _.template('', 1)(1);
      } catch (e) {
        pass = false;
      }
      assert.ok(pass, '`options` value');
    });

    QUnit.test('should expose the source on compiled templates', function(assert) {
      assert.expect(1);

      var compiled = _.template('x'),
          values = [String(compiled), compiled.source],
          expected = lodashStable.map(values, stubTrue);

      var actual = lodashStable.map(values, function(value) {
        return lodashStable.includes(value, '__p');
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should expose the source on SyntaxErrors', function(assert) {
      assert.expect(1);

      try {
        _.template('<% if x %>');
      } catch (e) {
        var source = e.source;
      }
      assert.ok(lodashStable.includes(source, '__p'));
    });

    QUnit.test('should not include sourceURLs in the source', function(assert) {
      assert.expect(1);

      var options = { 'sourceURL': '/a/b/c' },
          compiled = _.template('x', options),
          values = [compiled.source, undefined];

      try {
        _.template('<% if x %>', options);
      } catch (e) {
        values[1] = e.source;
      }
      var expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(values, function(value) {
        return lodashStable.includes(value, 'sourceURL');
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = ['<%= a %>', '<%- b %>', '<% print(c) %>'],
          compiles = lodashStable.map(array, _.template),
          data = { 'a': 'one', 'b': '`two`', 'c': 'three' };

      var actual = lodashStable.map(compiles, function(compiled) {
        return compiled(data);
      });

      assert.deepEqual(actual, ['one', '&#96;two&#96;', 'three']);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.truncate');

  (function() {
    var string = 'hi-diddly-ho there, neighborino';

    QUnit.test('should use a default `length` of `30`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.truncate(string), 'hi-diddly-ho there, neighbo...');
    });

    QUnit.test('should not truncate if `string` is <= `length`', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.truncate(string, { 'length': string.length }), string);
      assert.strictEqual(_.truncate(string, { 'length': string.length + 2 }), string);
    });

    QUnit.test('should truncate string the given length', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.truncate(string, { 'length': 24 }), 'hi-diddly-ho there, n...');
    });

    QUnit.test('should support a `omission` option', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.truncate(string, { 'omission': ' [...]' }), 'hi-diddly-ho there, neig [...]');
    });

    QUnit.test('should coerce nullish `omission` values to strings', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.truncate(string, { 'omission': null }), 'hi-diddly-ho there, neighbnull');
      assert.strictEqual(_.truncate(string, { 'omission': undefined }), 'hi-diddly-ho there, nundefined');
    });

    QUnit.test('should support a `length` option', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.truncate(string, { 'length': 4 }), 'h...');
    });

    QUnit.test('should support a `separator` option', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.truncate(string, { 'length': 24, 'separator': ' ' }), 'hi-diddly-ho there,...');
      assert.strictEqual(_.truncate(string, { 'length': 24, 'separator': /,? +/ }), 'hi-diddly-ho there...');
      assert.strictEqual(_.truncate(string, { 'length': 24, 'separator': /,? +/g }), 'hi-diddly-ho there...');
    });

    QUnit.test('should treat negative `length` as `0`', function(assert) {
      assert.expect(2);

      lodashStable.each([0, -2], function(length) {
        assert.strictEqual(_.truncate(string, { 'length': length }), '...');
      });
    });

    QUnit.test('should coerce `length` to an integer', function(assert) {
      assert.expect(4);

      lodashStable.each(['', NaN, 4.6, '4'], function(length, index) {
        var actual = index > 1 ? 'h...' : '...';
        assert.strictEqual(_.truncate(string, { 'length': { 'valueOf': lodashStable.constant(length) } }), actual);
      });
    });

    QUnit.test('should coerce `string` to a string', function(assert) {
      assert.expect(2);

      assert.strictEqual(_.truncate(Object(string), { 'length': 4 }), 'h...');
      assert.strictEqual(_.truncate({ 'toString': lodashStable.constant(string) }, { 'length': 5 }), 'hi...');
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map([string, string, string], _.truncate),
          truncated = 'hi-diddly-ho there, neighbo...';

      assert.deepEqual(actual, [truncated, truncated, truncated]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.throttle');

  (function() {
    QUnit.test('should throttle a function', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0,
          throttled = _.throttle(function() { callCount++; }, 32);

      throttled();
      throttled();
      throttled();

      var lastCount = callCount;
      assert.ok(callCount);

      setTimeout(function() {
        assert.ok(callCount > lastCount);
        done();
      }, 64);
    });

    QUnit.test('subsequent calls should return the result of the first call', function(assert) {
      assert.expect(5);

      var done = assert.async();

      var throttled = _.throttle(identity, 32),
          results = [throttled('a'), throttled('b')];

      assert.deepEqual(results, ['a', 'a']);

      setTimeout(function() {
        var results = [throttled('c'), throttled('d')];
        assert.notEqual(results[0], 'a');
        assert.notStrictEqual(results[0], undefined);

        assert.notEqual(results[1], 'd');
        assert.notStrictEqual(results[1], undefined);
        done();
      }, 64);
    });

    QUnit.test('should clear timeout when `func` is called', function(assert) {
      assert.expect(1);

      var done = assert.async();

      if (!isModularize) {
        var callCount = 0,
            dateCount = 0;

        var lodash = _.runInContext({
          'Date': {
            'now': function() {
              return ++dateCount == 5 ? Infinity : +new Date;
            }
          }
        });

        var throttled = lodash.throttle(function() { callCount++; }, 32);

        throttled();
        throttled();

        setTimeout(function() {
          assert.strictEqual(callCount, 2);
          done();
        }, 64);
      }
      else {
        skipAssert(assert);
        done();
      }
    });

    QUnit.test('should not trigger a trailing call when invoked once', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0,
          throttled = _.throttle(function() { callCount++; }, 32);

      throttled();
      assert.strictEqual(callCount, 1);

      setTimeout(function() {
        assert.strictEqual(callCount, 1);
        done();
      }, 64);
    });

    lodashStable.times(2, function(index) {
      QUnit.test('should trigger a call when invoked repeatedly' + (index ? ' and `leading` is `false`' : ''), function(assert) {
        assert.expect(1);

        var done = assert.async();

        var callCount = 0,
            limit = (argv || isPhantom) ? 1000 : 320,
            options = index ? { 'leading': false } : {},
            throttled = _.throttle(function() { callCount++; }, 32, options);

        var start = +new Date;
        while ((new Date - start) < limit) {
          throttled();
        }
        var actual = callCount > 1;
        setTimeout(function() {
          assert.ok(actual);
          done();
        }, 1);
      });
    });

    QUnit.test('should trigger a second throttled call as soon as possible', function(assert) {
      assert.expect(3);

      var done = assert.async();

      var callCount = 0;

      var throttled = _.throttle(function() {
        callCount++;
      }, 128, { 'leading': false });

      throttled();

      setTimeout(function() {
        assert.strictEqual(callCount, 1);
        throttled();
      }, 192);

      setTimeout(function() {
        assert.strictEqual(callCount, 1);
      }, 254);

      setTimeout(function() {
        assert.strictEqual(callCount, 2);
        done();
      }, 384);
    });

    QUnit.test('should apply default options', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0,
          throttled = _.throttle(function() { callCount++; }, 32, {});

      throttled();
      throttled();
      assert.strictEqual(callCount, 1);

      setTimeout(function() {
        assert.strictEqual(callCount, 2);
        done();
      }, 128);
    });

    QUnit.test('should support a `leading` option', function(assert) {
      assert.expect(2);

      var withLeading = _.throttle(identity, 32, { 'leading': true });
      assert.strictEqual(withLeading('a'), 'a');

      var withoutLeading = _.throttle(identity, 32, { 'leading': false });
      assert.strictEqual(withoutLeading('a'), undefined);
    });

    QUnit.test('should support a `trailing` option', function(assert) {
      assert.expect(6);

      var done = assert.async();

      var withCount = 0,
          withoutCount = 0;

      var withTrailing = _.throttle(function(value) {
        withCount++;
        return value;
      }, 64, { 'trailing': true });

      var withoutTrailing = _.throttle(function(value) {
        withoutCount++;
        return value;
      }, 64, { 'trailing': false });

      assert.strictEqual(withTrailing('a'), 'a');
      assert.strictEqual(withTrailing('b'), 'a');

      assert.strictEqual(withoutTrailing('a'), 'a');
      assert.strictEqual(withoutTrailing('b'), 'a');

      setTimeout(function() {
        assert.strictEqual(withCount, 2);
        assert.strictEqual(withoutCount, 1);
        done();
      }, 256);
    });

    QUnit.test('should not update `lastCalled`, at the end of the timeout, when `trailing` is `false`', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var callCount = 0;

      var throttled = _.throttle(function() {
        callCount++;
      }, 64, { 'trailing': false });

      throttled();
      throttled();

      setTimeout(function() {
        throttled();
        throttled();
      }, 96);

      setTimeout(function() {
        assert.ok(callCount > 1);
        done();
      }, 192);
    });

    QUnit.test('should work with a system time of `0`', function(assert) {
      assert.expect(3);

      var done = assert.async();

      if (!isModularize) {
        var callCount = 0,
            dateCount = 0;

        var lodash = _.runInContext({
          'Date': {
            'now': function() {
              return ++dateCount < 4 ? 0 : +new Date;
            }
          }
        });

        var throttled = lodash.throttle(function(value) {
          callCount++;
          return value;
        }, 32);

        var results = [throttled('a'), throttled('b'), throttled('c')];
        assert.deepEqual(results, ['a', 'a', 'a']);
        assert.strictEqual(callCount, 1);

        setTimeout(function() {
          assert.strictEqual(callCount, 2);
          done();
        }, 64);
      }
      else {
        skipAssert(assert, 3);
        done();
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.debounce and lodash.throttle');

  lodashStable.each(['debounce', 'throttle'], function(methodName) {
    var func = _[methodName],
        isDebounce = methodName == 'debounce';

    QUnit.test('`_.' + methodName + '` should not error for non-object `options` values', function(assert) {
      assert.expect(1);

      var pass = true;

      try {
        func(noop, 32, 1);
      } catch (e) {
        pass = false;
      }
      assert.ok(pass);
    });

    QUnit.test('`_.' + methodName + '` should use a default `wait` of `0`', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var callCount = 0,
          funced = func(function() { callCount++; });

      funced();

      setTimeout(function() {
        funced();
        assert.strictEqual(callCount, isDebounce ? 1 : 2);
        done();
      }, 32);
    });

    QUnit.test('`_.' + methodName + '` should invoke `func` with the correct `this` binding', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var actual = [],
          object = { 'funced': func(function() { actual.push(this); }, 32) },
          expected = lodashStable.times(isDebounce ? 1 : 2, lodashStable.constant(object));

      object.funced();
      if (!isDebounce) {
        object.funced();
      }
      setTimeout(function() {
        assert.deepEqual(actual, expected);
        done();
      }, 64);
    });

    QUnit.test('`_.' + methodName + '` supports recursive calls', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var actual = [],
          args = lodashStable.map(['a', 'b', 'c'], function(chr) { return [{}, chr]; }),
          expected = args.slice(),
          queue = args.slice();

      var funced = func(function() {
        var current = [this];
        push.apply(current, arguments);
        actual.push(current);

        var next = queue.shift();
        if (next) {
          funced.call(next[0], next[1]);
        }
      }, 32);

      var next = queue.shift();
      funced.call(next[0], next[1]);
      assert.deepEqual(actual, expected.slice(0, isDebounce ? 0 : 1));

      setTimeout(function() {
        assert.deepEqual(actual, expected.slice(0, actual.length));
        done();
      }, 256);
    });

    QUnit.test('`_.' + methodName + '` should work if the system time is set backwards', function(assert) {
      assert.expect(1);

      var done = assert.async();

      if (!isModularize) {
        var callCount = 0,
            dateCount = 0;

        var lodash = _.runInContext({
          'Date': {
            'now': function() {
              return ++dateCount == 4
                ? +new Date(2012, 3, 23, 23, 27, 18)
                : +new Date;
            }
          }
        });

        var funced = lodash[methodName](function() {
          callCount++;
        }, 32);

        funced();

        setTimeout(function() {
          funced();
          assert.strictEqual(callCount, isDebounce ? 1 : 2);
          done();
        }, 64);
      }
      else {
        skipAssert(assert);
        done();
      }
    });

    QUnit.test('`_.' + methodName + '` should support cancelling delayed calls', function(assert) {
      assert.expect(1);

      var done = assert.async();

      var callCount = 0;

      var funced = func(function() {
        callCount++;
      }, 32, { 'leading': false });

      funced();
      funced.cancel();

      setTimeout(function() {
        assert.strictEqual(callCount, 0);
        done();
      }, 64);
    });

    QUnit.test('`_.' + methodName + '` should reset `lastCalled` after cancelling', function(assert) {
      assert.expect(3);

      var done = assert.async();

      var callCount = 0;

      var funced = func(function() {
        return ++callCount;
      }, 32, { 'leading': true });

      assert.strictEqual(funced(), 1);
      funced.cancel();

      assert.strictEqual(funced(), 2);
      funced();

      setTimeout(function() {
        assert.strictEqual(callCount, 3);
        done();
      }, 64);
    });

    QUnit.test('`_.' + methodName + '` should support flushing delayed calls', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0;

      var funced = func(function() {
        return ++callCount;
      }, 32, { 'leading': false });

      funced();
      assert.strictEqual(funced.flush(), 1);

      setTimeout(function() {
        assert.strictEqual(callCount, 1);
        done();
      }, 64);
    });

    QUnit.test('`_.' + methodName + '` should noop `cancel` and `flush` when nothing is queued', function(assert) {
      assert.expect(2);

      var done = assert.async();

      var callCount = 0,
          funced = func(function() { callCount++; }, 32);

      funced.cancel();
      assert.strictEqual(funced.flush(), undefined);

      setTimeout(function() {
        assert.strictEqual(callCount, 0);
        done();
      }, 64);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.times');

  (function() {
    QUnit.test('should coerce non-finite `n` values to `0`', function(assert) {
      assert.expect(3);

      lodashStable.each([-Infinity, NaN, Infinity], function(n) {
        assert.deepEqual(_.times(n), []);
      });
    });

    QUnit.test('should coerce `n` to an integer', function(assert) {
      assert.expect(1);

      var actual = _.times(2.6, _.indentify);
      assert.deepEqual(actual, [0, 1]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.times(1, function(assert) {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [0]);
    });

    QUnit.test('should use `_.identity` when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant([0, 1, 2]));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.times(3, value) : _.times(3);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an array of the results of each `iteratee` execution', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.times(3, doubled), [0, 2, 4]);
    });

    QUnit.test('should return an empty array for falsey and negative `n` arguments', function(assert) {
      assert.expect(1);

      var values = falsey.concat(-1, -Infinity),
          expected = lodashStable.map(values, stubArray);

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.times(value) : _.times();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.deepEqual(_(3).times(), [0, 1, 2]);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        assert.ok(_(3).chain().times() instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toArray');

  (function() {
    QUnit.test('should convert objects to arrays', function(assert) {
      assert.expect(1);

      assert.deepEqual(_.toArray({ 'a': 1, 'b': 2 }), [1, 2]);
    });

    QUnit.test('should convert iterables to arrays', function(assert) {
      assert.expect(1);

      if (Symbol && Symbol.iterator) {
        var object = { '0': 'a', 'length': 1 };
        object[Symbol.iterator] = arrayProto[Symbol.iterator];

        assert.deepEqual(_.toArray(object), ['a']);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should convert maps to arrays', function(assert) {
      assert.expect(1);

      if (Map) {
        var map = new Map;
        map.set('a', 1);
        map.set('b', 2);
        assert.deepEqual(_.toArray(map), [['a', 1], ['b', 2]]);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should convert strings to arrays', function(assert) {
      assert.expect(3);

      assert.deepEqual(_.toArray(''), []);
      assert.deepEqual(_.toArray('ab'), ['a', 'b']);
      assert.deepEqual(_.toArray(Object('ab')), ['a', 'b']);
    });

    QUnit.test('should work in a lazy sequence', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE + 1);

        var object = lodashStable.zipObject(lodashStable.times(LARGE_ARRAY_SIZE, function(index) {
          return ['key' + index, index];
        }));

        var actual = _(array).slice(1).map(String).toArray().value();
        assert.deepEqual(actual, lodashStable.map(array.slice(1), String));

        actual = _(object).toArray().slice(1).map(String).value();
        assert.deepEqual(actual, _.map(_.toArray(object).slice(1), String));
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toLower');

  (function() {
    QUnit.test('should convert whole string to lower case', function(assert) {
      assert.expect(3);

      assert.deepEqual(_.toLower('--Foo-Bar--'), '--foo-bar--');
      assert.deepEqual(_.toLower('fooBar'), 'foobar');
      assert.deepEqual(_.toLower('__FOO_BAR__'), '__foo_bar__');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toUpper');

  (function() {
    QUnit.test('should convert whole string to upper case', function(assert) {
      assert.expect(3);

      assert.deepEqual(_.toUpper('--Foo-Bar'), '--FOO-BAR');
      assert.deepEqual(_.toUpper('fooBar'), 'FOOBAR');
      assert.deepEqual(_.toUpper('__FOO_BAR__'), '__FOO_BAR__');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.slice and lodash.toArray');

  lodashStable.each(['slice', 'toArray'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        array = [1, 2, 3],
        func = _[methodName];

    QUnit.test('`_.' + methodName + '` should return a dense array', function(assert) {
      assert.expect(3);

      var sparse = Array(3);
      sparse[1] = 2;

      var actual = func(sparse);

      assert.ok('0' in actual);
      assert.ok('2' in actual);
      assert.deepEqual(actual, sparse);
    });

    QUnit.test('`_.' + methodName + '` should treat array-like objects like arrays', function(assert) {
      assert.expect(2);

      var object = { '0': 'a', 'length': 1 };
      assert.deepEqual(func(object), ['a']);
      assert.deepEqual(func(args), array);
    });

    QUnit.test('`_.' + methodName + '` should return a shallow clone of arrays', function(assert) {
      assert.expect(2);

      var actual = func(array);
      assert.deepEqual(actual, array);
      assert.notStrictEqual(actual, array);
    });

    QUnit.test('`_.' + methodName + '` should work with a node list for `collection`', function(assert) {
      assert.expect(1);

      if (document) {
        try {
          var actual = func(document.getElementsByTagName('body'));
        } catch (e) {}

        assert.deepEqual(actual, [body]);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('toInteger methods');

  lodashStable.each(['toInteger', 'toSafeInteger'], function(methodName) {
    var func = _[methodName],
        isSafe = methodName == 'toSafeInteger';

    QUnit.test('`_.' + methodName + '` should convert values to integers', function(assert) {
      assert.expect(6);

      assert.strictEqual(func(-5.6), -5);
      assert.strictEqual(func('5.6'), 5);
      assert.strictEqual(func(), 0);
      assert.strictEqual(func(NaN), 0);

      var expected = isSafe ? MAX_SAFE_INTEGER : MAX_INTEGER;
      assert.strictEqual(func(Infinity), expected);
      assert.strictEqual(func(-Infinity), -expected);
    });

    QUnit.test('`_.' + methodName + '` should support `value` of `-0`', function(assert) {
      assert.expect(1);

      assert.strictEqual(1 / func(-0), -Infinity);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toLength');

  (function() {
    QUnit.test('should return a valid length', function(assert) {
      assert.expect(4);

      assert.strictEqual(_.toLength(-1), 0);
      assert.strictEqual(_.toLength('1'), 1);
      assert.strictEqual(_.toLength(1.1), 1);
      assert.strictEqual(_.toLength(MAX_INTEGER), MAX_ARRAY_LENGTH);
    });

    QUnit.test('should return `value` if a valid length', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.toLength(0), 0);
      assert.strictEqual(_.toLength(3), 3);
      assert.strictEqual(_.toLength(MAX_ARRAY_LENGTH), MAX_ARRAY_LENGTH);
    });

    QUnit.test('should convert `-0` to `0`', function(assert) {
      assert.expect(1);

      assert.strictEqual(1 / _.toLength(-0), Infinity);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('number coercion methods');

  lodashStable.each(['toFinite', 'toInteger', 'toNumber', 'toSafeInteger'], function(methodName) {
    var func = _[methodName];

    QUnit.test('`_.' + methodName + '` should preserve the sign of `0`', function(assert) {
      assert.expect(2);

      var values = [0, '0', -0, '-0'],
          expected = [[0, Infinity], [0, Infinity], [-0, -Infinity], [-0, -Infinity]];

      lodashStable.times(2, function(index) {
        var others = lodashStable.map(values, index ? Object : identity);

        var actual = lodashStable.map(others, function(value) {
          var result = func(value);
          return [result, 1 / result];
        });

        assert.deepEqual(actual, expected);
      });
    });
  });

  lodashStable.each(['toFinite', 'toInteger', 'toLength', 'toNumber', 'toSafeInteger'], function(methodName) {
    var func = _[methodName],
        isToFinite = methodName == 'toFinite',
        isToLength = methodName == 'toLength',
        isToNumber = methodName == 'toNumber',
        isToSafeInteger = methodName == 'toSafeInteger';

    function negative(string) {
      return '-' + string;
    }

    function pad(string) {
      return whitespace + string + whitespace;
    }

    function positive(string) {
      return '+' + string;
    }

    QUnit.test('`_.' + methodName + '` should pass thru primitive number values', function(assert) {
      assert.expect(1);

      var values = [0, 1, NaN];

      var expected = lodashStable.map(values, function(value) {
        return (!isToNumber && value !== value) ? 0 : value;
      });

      var actual = lodashStable.map(values, func);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should convert number primitives and objects to numbers', function(assert) {
      assert.expect(1);

      var values = [2, 1.2, MAX_SAFE_INTEGER, MAX_INTEGER, Infinity, NaN];

      var expected = lodashStable.map(values, function(value) {
        if (!isToNumber) {
          if (!isToFinite && value == 1.2) {
            value = 1;
          }
          else if (value == Infinity) {
            value = MAX_INTEGER;
          }
          else if (value !== value) {
            value = 0;
          }
          if (isToLength || isToSafeInteger) {
            value = Math.min(value, isToLength ? MAX_ARRAY_LENGTH : MAX_SAFE_INTEGER);
          }
        }
        var neg = isToLength ? 0 : -value;
        return [value, value, neg, neg];
      });

      var actual = lodashStable.map(values, function(value) {
        return [func(value), func(Object(value)), func(-value), func(Object(-value))];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should convert string primitives and objects to numbers', function(assert) {
      assert.expect(1);

      var transforms = [identity, pad, positive, negative];

      var values = [
        '10', '1.234567890', (MAX_SAFE_INTEGER + ''),
        '1e+308', '1e308', '1E+308', '1E308',
        '5e-324', '5E-324',
        'Infinity', 'NaN'
      ];

      var expected = lodashStable.map(values, function(value) {
        var n = +value;
        if (!isToNumber) {
          if (!isToFinite && n == 1.234567890) {
            n = 1;
          }
          else if (n == Infinity) {
            n = MAX_INTEGER;
          }
          else if ((!isToFinite && n == Number.MIN_VALUE) || n !== n) {
            n = 0;
          }
          if (isToLength || isToSafeInteger) {
            n = Math.min(n, isToLength ? MAX_ARRAY_LENGTH : MAX_SAFE_INTEGER);
          }
        }
        var neg = isToLength ? 0 : -n;
        return [n, n, n, n, n, n, neg, neg];
      });

      var actual = lodashStable.map(values, function(value) {
        return lodashStable.flatMap(transforms, function(mod) {
          return [func(mod(value)), func(Object(mod(value)))];
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should convert binary/octal strings to numbers', function(assert) {
      assert.expect(1);

      var numbers = [42, 5349, 1715004],
          transforms = [identity, pad],
          values = ['0b101010', '0o12345', '0x1a2b3c'];

      var expected = lodashStable.map(numbers, function(n) {
        return lodashStable.times(8, lodashStable.constant(n));
      });

      var actual = lodashStable.map(values, function(value) {
        var upper = value.toUpperCase();
        return lodashStable.flatMap(transforms, function(mod) {
          return [func(mod(value)), func(Object(mod(value))), func(mod(upper)), func(Object(mod(upper)))];
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should convert invalid binary/octal strings to `' + (isToNumber ? 'NaN' : '0') + '`', function(assert) {
      assert.expect(1);

      var transforms = [identity, pad, positive, negative],
          values = ['0b', '0o', '0x', '0b1010102', '0o123458', '0x1a2b3x'];

      var expected = lodashStable.map(values, function(n) {
        return lodashStable.times(8, lodashStable.constant(isToNumber ? NaN : 0));
      });

      var actual = lodashStable.map(values, function(value) {
        return lodashStable.flatMap(transforms, function(mod) {
          return [func(mod(value)), func(Object(mod(value)))];
        });
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should convert symbols to `' + (isToNumber ? 'NaN' : '0') + '`', function(assert) {
      assert.expect(1);

      if (Symbol) {
        var object1 = Object(symbol),
            object2 = Object(symbol),
            values = [symbol, object1, object2],
            expected = lodashStable.map(values, lodashStable.constant(isToNumber ? NaN : 0));

        object2.valueOf = undefined;
        var actual = lodashStable.map(values, func);

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should convert empty values to `0` or `NaN`', function(assert) {
      assert.expect(1);

      var values = falsey.concat(whitespace);

      var expected = lodashStable.map(values, function(value) {
        return (isToNumber && value !== whitespace) ? Number(value) : 0;
      });

      var actual = lodashStable.map(values, function(value, index) {
        return index ? func(value) : func();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should coerce objects to numbers', function(assert) {
      assert.expect(1);

      var values = [
        {},
        [],
        [1],
        [1, 2],
        { 'valueOf': '1.1' },
        { 'valueOf': '1.1', 'toString': lodashStable.constant('2.2') },
        { 'valueOf': lodashStable.constant('1.1'), 'toString': '2.2' },
        { 'valueOf': lodashStable.constant('1.1'), 'toString': lodashStable.constant('2.2') },
        { 'valueOf': lodashStable.constant('-0x1a2b3c') },
        { 'toString': lodashStable.constant('-0x1a2b3c') },
        { 'valueOf': lodashStable.constant('0o12345') },
        { 'toString': lodashStable.constant('0o12345') },
        { 'valueOf': lodashStable.constant('0b101010') },
        { 'toString': lodashStable.constant('0b101010') }
      ];

      var expected = [
        NaN,  0,   1,   NaN,
        NaN,  2.2, 1.1, 1.1,
        NaN,  NaN,
        5349, 5349,
        42,   42
      ];

      if (isToFinite) {
        expected = [
          0,    0,    1,   0,
          0,    2.2,  1.1, 1.1,
          0,    0,
          5349, 5349,
          42,   42
        ];
      }
      else if (!isToNumber) {
        expected = [
          0,    0,    1, 0,
          0,    2,    1, 1,
          0,    0,
          5349, 5349,
          42,   42
        ];
      }
      var actual = lodashStable.map(values, func);

      assert.deepEqual(actual, expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toPairs');

  (function() {
    QUnit.test('should be aliased', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.entries, _.toPairs);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toPairsIn');

  (function() {
    QUnit.test('should be aliased', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.entriesIn, _.toPairsIn);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('toPairs methods');

  lodashStable.each(['toPairs', 'toPairsIn'], function(methodName) {
    var func = _[methodName],
        isToPairs = methodName == 'toPairs';

    QUnit.test('`_.' + methodName + '` should create an array of string keyed-value pairs', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2 },
          actual = lodashStable.sortBy(func(object), 0);

      assert.deepEqual(actual, [['a', 1], ['b', 2]]);
    });

    QUnit.test('`_.' + methodName + '` should ' + (isToPairs ? 'not ' : '') + 'include inherited string keyed property values', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var expected = isToPairs ? [['a', 1]] : [['a', 1], ['b', 2]],
          actual = lodashStable.sortBy(func(new Foo), 0);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should convert objects with a `length` property', function(assert) {
      assert.expect(1);

      var object = { '0': 'a', '1': 'b', 'length': 2 },
          actual = lodashStable.sortBy(func(object), 0);

      assert.deepEqual(actual, [['0', 'a'], ['1', 'b'], ['length', 2]]);
    });

    QUnit.test('`_.' + methodName + '` should convert maps', function(assert) {
      assert.expect(1);

      if (Map) {
        var map = new Map;
        map.set('a', 1);
        map.set('b', 2);
        assert.deepEqual(func(map), [['a', 1], ['b', 2]]);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should convert sets', function(assert) {
      assert.expect(1);

      if (Set) {
        var set = new Set;
        set.add(1);
        set.add(2);
        assert.deepEqual(func(set), [[1, 1], [2, 2]]);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should convert strings', function(assert) {
      assert.expect(2);

      lodashStable.each(['xo', Object('xo')], function(string) {
        var actual = lodashStable.sortBy(func(string), 0);
        assert.deepEqual(actual, [['0', 'x'], ['1', 'o']]);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toPath');

  (function() {
    QUnit.test('should convert a string to a path', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.toPath('a.b.c'), ['a', 'b', 'c']);
      assert.deepEqual(_.toPath('a[0].b.c'), ['a', '0', 'b', 'c']);
    });

    QUnit.test('should coerce array elements to strings', function(assert) {
      assert.expect(4);

      var array = ['a', 'b', 'c'];

      lodashStable.each([array, lodashStable.map(array, Object)], function(value) {
        var actual = _.toPath(value);
        assert.deepEqual(actual, array);
        assert.notStrictEqual(actual, array);
      });
    });

    QUnit.test('should a new path array', function(assert) {
      assert.expect(1);

      assert.notStrictEqual(_.toPath('a.b.c'), _.toPath('a.b.c'));
    });

    QUnit.test('should not coerce symbols to strings', function(assert) {
      assert.expect(4);

      if (Symbol) {
        var object = Object(symbol);
        lodashStable.each([symbol, object, [symbol], [object]], function(value) {
          var actual = _.toPath(value);
          assert.ok(lodashStable.isSymbol(actual[0]));
        });
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should handle complex paths', function(assert) {
      assert.expect(1);

      var actual = _.toPath('a[-1.23]["[\\"b\\"]"].c[\'[\\\'d\\\']\'][\ne\n][f].g');
      assert.deepEqual(actual, ['a', '-1.23', '["b"]', 'c', "['d']", '\ne\n', 'f', 'g']);
    });

    QUnit.test('should handle consecutive empty brackets and dots', function(assert) {
      assert.expect(12);

      var expected = ['', 'a'];
      assert.deepEqual(_.toPath('.a'), expected);
      assert.deepEqual(_.toPath('[].a'), expected);

      expected = ['', '', 'a'];
      assert.deepEqual(_.toPath('..a'), expected);
      assert.deepEqual(_.toPath('[][].a'), expected);

      expected = ['a', '', 'b'];
      assert.deepEqual(_.toPath('a..b'), expected);
      assert.deepEqual(_.toPath('a[].b'), expected);

      expected = ['a', '', '', 'b'];
      assert.deepEqual(_.toPath('a...b'), expected);
      assert.deepEqual(_.toPath('a[][].b'), expected);

      expected = ['a', ''];
      assert.deepEqual(_.toPath('a.'), expected);
      assert.deepEqual(_.toPath('a[]'), expected);

      expected = ['a', '', ''];
      assert.deepEqual(_.toPath('a..'), expected);
      assert.deepEqual(_.toPath('a[][]'), expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toPlainObject');

  (function() {
    var args = arguments;

    QUnit.test('should flatten inherited string keyed properties', function(assert) {
      assert.expect(1);

      function Foo() {
        this.b = 2;
      }
      Foo.prototype.c = 3;

      var actual = lodashStable.assign({ 'a': 1 }, _.toPlainObject(new Foo));
      assert.deepEqual(actual, { 'a': 1, 'b': 2, 'c': 3 });
    });

    QUnit.test('should convert `arguments` objects to plain objects', function(assert) {
      assert.expect(1);

      var actual = _.toPlainObject(args),
          expected = { '0': 1, '1': 2, '2': 3 };

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should convert arrays to plain objects', function(assert) {
      assert.expect(1);

      var actual = _.toPlainObject(['a', 'b', 'c']),
          expected = { '0': 'a', '1': 'b', '2': 'c' };

      assert.deepEqual(actual, expected);
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.toString');

  (function() {
    QUnit.test('should treat nullish values as empty strings', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubString);

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.toString(value) : _.toString();
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var values = [-0, Object(-0), 0, Object(0)],
          expected = ['-0', '-0', '0', '0'],
          actual = lodashStable.map(values, _.toString);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not error on symbols', function(assert) {
      assert.expect(1);

      if (Symbol) {
        try {
          assert.strictEqual(_.toString(symbol), 'Symbol(a)');
        } catch (e) {
          assert.ok(false, e.message);
        }
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should return the `toString` result of the wrapped value', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _([1, 2, 3]);
        assert.strictEqual(wrapped.toString(), '1,2,3');
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.transform');

  (function() {
    function Foo() {
      this.a = 1;
      this.b = 2;
      this.c = 3;
    }

    QUnit.test('should create an object with the same `[[Prototype]]` as `object` when `accumulator` is nullish', function(assert) {
      assert.expect(4);

      var accumulators = [, null, undefined],
          object = new Foo,
          expected = lodashStable.map(accumulators, stubTrue);

      var iteratee = function(result, value, key) {
        result[key] = square(value);
      };

      var mapper = function(accumulator, index) {
        return index ? _.transform(object, iteratee, accumulator) : _.transform(object, iteratee);
      };

      var results = lodashStable.map(accumulators, mapper);

      var actual = lodashStable.map(results, function(result) {
        return result instanceof Foo;
      });

      assert.deepEqual(actual, expected);

      expected = lodashStable.map(accumulators, lodashStable.constant({ 'a': 1, 'b': 4, 'c': 9 }));
      actual = lodashStable.map(results, lodashStable.toPlainObject);

      assert.deepEqual(actual, expected);

      object = { 'a': 1, 'b': 2, 'c': 3 };
      actual = lodashStable.map(accumulators, mapper);

      assert.deepEqual(actual, expected);

      object = [1, 2, 3];
      expected = lodashStable.map(accumulators, lodashStable.constant([1, 4, 9]));
      actual = lodashStable.map(accumulators, mapper);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should create regular arrays from typed arrays', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(typedArrays, stubTrue);

      var actual = lodashStable.map(typedArrays, function(type) {
        var Ctor = root[type],
            array = Ctor ? new Ctor(new ArrayBuffer(24)) : [];

        return lodashStable.isArray(_.transform(array, noop));
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should support an `accumulator` value', function(assert) {
      assert.expect(6);

      var values = [new Foo, [1, 2, 3], { 'a': 1, 'b': 2, 'c': 3 }],
          expected = lodashStable.map(values, lodashStable.constant([1, 4, 9]));

      var actual = lodashStable.map(values, function(value) {
        return _.transform(value, function(result, value) {
          result.push(square(value));
        }, []);
      });

      assert.deepEqual(actual, expected);

      var object = { 'a': 1, 'b': 4, 'c': 9 },
      expected = [object, { '0': 1, '1': 4, '2': 9 }, object];

      actual = lodashStable.map(values, function(value) {
        return _.transform(value, function(result, value, key) {
          result[key] = square(value);
        }, {});
      });

      assert.deepEqual(actual, expected);

      lodashStable.each([[], {}], function(accumulator) {
        var actual = lodashStable.map(values, function(value) {
          return _.transform(value, noop, accumulator);
        });

        assert.ok(lodashStable.every(actual, function(result) {
          return result === accumulator;
        }));

        assert.strictEqual(_.transform(null, null, accumulator), accumulator);
      });
    });

    QUnit.test('should treat sparse arrays as dense', function(assert) {
      assert.expect(1);

      var actual = _.transform(Array(1), function(result, value, index) {
        result[index] = String(value);
      });

      assert.deepEqual(actual, ['undefined']);
    });

    QUnit.test('should work without an `iteratee` argument', function(assert) {
      assert.expect(1);

      assert.ok(_.transform(new Foo) instanceof Foo);
    });

    QUnit.test('should ensure `object` is an object before using its `[[Prototype]]`', function(assert) {
      assert.expect(2);

      var Ctors = [Boolean, Boolean, Number, Number, Number, String, String],
          values = [false, true, 0, 1, NaN, '', 'a'],
          expected = lodashStable.map(values, stubObject);

      var results = lodashStable.map(values, function(value) {
        return _.transform(value);
      });

      assert.deepEqual(results, expected);

      expected = lodashStable.map(values, stubFalse);

      var actual = lodashStable.map(results, function(value, index) {
        return value instanceof Ctors[index];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should ensure `object` constructor is a function before using its `[[Prototype]]`', function(assert) {
      assert.expect(1);

      Foo.prototype.constructor = null;
      assert.notOk(_.transform(new Foo) instanceof Foo);
      Foo.prototype.constructor = Foo;
    });

    QUnit.test('should create an empty object when given a falsey `object` argument', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubObject);

      var actual = lodashStable.map(falsey, function(object, index) {
        return index ? _.transform(object) : _.transform();
      });

      assert.deepEqual(actual, expected);
    });

    lodashStable.each({
      'array': [1, 2, 3],
      'object': { 'a': 1, 'b': 2, 'c': 3 }
    },
    function(object, key) {
      QUnit.test('should provide correct `iteratee` arguments when transforming an ' + key, function(assert) {
        assert.expect(2);

        var args;

        _.transform(object, function() {
          args || (args = slice.call(arguments));
        });

        var first = args[0];
        if (key == 'array') {
          assert.ok(first !== object && lodashStable.isArray(first));
          assert.deepEqual(args, [first, 1, 0, object]);
        } else {
          assert.ok(first !== object && lodashStable.isPlainObject(first));
          assert.deepEqual(args, [first, 1, 'a', object]);
        }
      });
    });

    QUnit.test('should create an object from the same realm as `object`', function(assert) {
      assert.expect(1);

      var objects = lodashStable.filter(realm, function(value) {
        return lodashStable.isObject(value) && !lodashStable.isElement(value);
      });

      var expected = lodashStable.map(objects, stubTrue);

      var actual = lodashStable.map(objects, function(object) {
        var Ctor = object.constructor,
            result = _.transform(object);

        if (result === object) {
          return false;
        }
        if (lodashStable.isTypedArray(object)) {
          return result instanceof Array;
        }
        return result instanceof Ctor || !(new Ctor instanceof Ctor);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('trim methods');

  lodashStable.each(['trim', 'trimStart', 'trimEnd'], function(methodName, index) {
    var func = _[methodName],
        parts = [];

    if (index != 2) {
      parts.push('leading');
    }
    if (index != 1) {
      parts.push('trailing');
    }
    parts = parts.join(' and ');

    QUnit.test('`_.' + methodName + '` should remove ' + parts + ' whitespace', function(assert) {
      assert.expect(1);

      var string = whitespace + 'a b c' + whitespace,
          expected = (index == 2 ? whitespace : '') + 'a b c' + (index == 1 ? whitespace : '');

      assert.strictEqual(func(string), expected);
    });

    QUnit.test('`_.' + methodName + '` should coerce `string` to a string', function(assert) {
      assert.expect(1);

      var object = { 'toString': lodashStable.constant(whitespace + 'a b c' + whitespace) },
          expected = (index == 2 ? whitespace : '') + 'a b c' + (index == 1 ? whitespace : '');

      assert.strictEqual(func(object), expected);
    });

    QUnit.test('`_.' + methodName + '` should remove ' + parts + ' `chars`', function(assert) {
      assert.expect(1);

      var string = '-_-a-b-c-_-',
          expected = (index == 2 ? '-_-' : '') + 'a-b-c' + (index == 1 ? '-_-' : '');

      assert.strictEqual(func(string, '_-'), expected);
    });

    QUnit.test('`_.' + methodName + '` should coerce `chars` to a string', function(assert) {
      assert.expect(1);

      var object = { 'toString': lodashStable.constant('_-') },
          string = '-_-a-b-c-_-',
          expected = (index == 2 ? '-_-' : '') + 'a-b-c' + (index == 1 ? '-_-' : '');

      assert.strictEqual(func(string, object), expected);
    });

    QUnit.test('`_.' + methodName + '` should return an empty string for empty values and `chars`', function(assert) {
      assert.expect(6);

      lodashStable.each([null, '_-'], function(chars) {
        assert.strictEqual(func(null, chars), '');
        assert.strictEqual(func(undefined, chars), '');
        assert.strictEqual(func('', chars), '');
      });
    });

    QUnit.test('`_.' + methodName + '` should work with `undefined` or empty string values for `chars`', function(assert) {
      assert.expect(2);

      var string = whitespace + 'a b c' + whitespace,
          expected = (index == 2 ? whitespace : '') + 'a b c' + (index == 1 ? whitespace : '');

      assert.strictEqual(func(string, undefined), expected);
      assert.strictEqual(func(string, ''), string);
    });

    QUnit.test('`_.' + methodName + '` should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var string = Object(whitespace + 'a b c' + whitespace),
          trimmed = (index == 2 ? whitespace : '') + 'a b c' + (index == 1 ? whitespace : ''),
          actual = lodashStable.map([string, string, string], func);

      assert.deepEqual(actual, [trimmed, trimmed, trimmed]);
    });

    QUnit.test('`_.' + methodName + '` should return an unwrapped value when implicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var string = whitespace + 'a b c' + whitespace,
            expected = (index == 2 ? whitespace : '') + 'a b c' + (index == 1 ? whitespace : '');

        assert.strictEqual(_(string)[methodName](), expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when explicitly chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var string = whitespace + 'a b c' + whitespace;
        assert.ok(_(string).chain()[methodName]() instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('uncommon symbols');

  (function() {
    var flag = '\ud83c\uddfa\ud83c\uddf8',
        heart = '\u2764' + emojiVar,
        hearts = '\ud83d\udc95',
        comboGlyph = '\ud83d\udc68\u200d' + heart + '\u200d\ud83d\udc8B\u200d\ud83d\udc68',
        hashKeycap = '#' + emojiVar + '\u20e3',
        leafs = '\ud83c\udf42',
        mic = '\ud83c\udf99',
        noMic = mic + '\u20e0',
        raisedHand = '\u270B' + emojiVar,
        rocket = '\ud83d\ude80',
        thumbsUp = '\ud83d\udc4d';

    QUnit.test('should account for astral symbols', function(assert) {
      assert.expect(34);

      var allHearts = _.repeat(hearts, 10),
          chars = hearts + comboGlyph,
          string = 'A ' + leafs + ', ' + comboGlyph + ', and ' + rocket,
          trimChars = comboGlyph + hearts,
          trimString = trimChars + string + trimChars;

      assert.strictEqual(_.camelCase(hearts + ' the ' + leafs), hearts + 'The' + leafs);
      assert.strictEqual(_.camelCase(string), 'a' + leafs + comboGlyph + 'And' + rocket);
      assert.strictEqual(_.capitalize(rocket), rocket);

      assert.strictEqual(_.pad(string, 16), ' ' + string + '  ');
      assert.strictEqual(_.padStart(string, 16), '   ' + string);
      assert.strictEqual(_.padEnd(string, 16), string + '   ');

      assert.strictEqual(_.pad(string, 16, chars), hearts + string + chars);
      assert.strictEqual(_.padStart(string, 16, chars), chars + hearts + string);
      assert.strictEqual(_.padEnd(string, 16, chars), string + chars + hearts);

      assert.strictEqual(_.size(string), 13);
      assert.deepEqual(_.split(string, ' '), ['A', leafs + ',', comboGlyph + ',', 'and', rocket]);
      assert.deepEqual(_.split(string, ' ', 3), ['A', leafs + ',', comboGlyph + ',']);
      assert.deepEqual(_.split(string, undefined), [string]);
      assert.deepEqual(_.split(string, undefined, -1), [string]);
      assert.deepEqual(_.split(string, undefined, 0), []);

      var expected = ['A', ' ', leafs, ',', ' ', comboGlyph, ',', ' ', 'a', 'n', 'd', ' ', rocket];

      assert.deepEqual(_.split(string, ''), expected);
      assert.deepEqual(_.split(string, '', 6), expected.slice(0, 6));
      assert.deepEqual(_.toArray(string), expected);

      assert.strictEqual(_.trim(trimString, chars), string);
      assert.strictEqual(_.trimStart(trimString, chars), string + trimChars);
      assert.strictEqual(_.trimEnd(trimString, chars), trimChars + string);

      assert.strictEqual(_.truncate(string, { 'length': 13 }), string);
      assert.strictEqual(_.truncate(string, { 'length': 6 }), 'A ' + leafs + '...');

      assert.deepEqual(_.words(string), ['A', leafs, comboGlyph, 'and', rocket]);
      assert.deepEqual(_.toArray(hashKeycap), [hashKeycap]);
      assert.deepEqual(_.toArray(noMic), [noMic]);

      lodashStable.times(2, function(index) {
        var separator = index ? RegExp(hearts) : hearts,
            options = { 'length': 4, 'separator': separator },
            actual = _.truncate(string, options);

        assert.strictEqual(actual, 'A...');
        assert.strictEqual(actual.length, 4);

        actual = _.truncate(allHearts, options);
        assert.strictEqual(actual, hearts + '...');
        assert.strictEqual(actual.length, 5);
      });
    });

    QUnit.test('should account for combining diacritical marks', function(assert) {
      assert.expect(1);

      var values = lodashStable.map(comboMarks, function(mark) {
        return 'o' + mark;
      });

      var expected = lodashStable.map(values, function(value) {
        return [1, [value], [value]];
      });

      var actual = lodashStable.map(values, function(value) {
        return [_.size(value), _.toArray(value), _.words(value)];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should account for fitzpatrick modifiers', function(assert) {
      assert.expect(1);

      var values = lodashStable.map(fitzModifiers, function(modifier) {
        return thumbsUp + modifier;
      });

      var expected = lodashStable.map(values, function(value) {
        return [1, [value], [value]];
      });

      var actual = lodashStable.map(values, function(value) {
        return [_.size(value), _.toArray(value), _.words(value)];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should account for regional symbols', function(assert) {
      assert.expect(6);

      var pair = flag.match(/\ud83c[\udde6-\uddff]/g),
          regionals = pair.join(' ');

      assert.strictEqual(_.size(flag), 1);
      assert.strictEqual(_.size(regionals), 3);

      assert.deepEqual(_.toArray(flag), [flag]);
      assert.deepEqual(_.toArray(regionals), [pair[0], ' ', pair[1]]);

      assert.deepEqual(_.words(flag), [flag]);
      assert.deepEqual(_.words(regionals), [pair[0], pair[1]]);
    });

    QUnit.test('should account for variation selectors', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.size(heart), 1);
      assert.deepEqual(_.toArray(heart), [heart]);
      assert.deepEqual(_.words(heart), [heart]);
    });

    QUnit.test('should account for variation selectors with fitzpatrick modifiers', function(assert) {
      assert.expect(1);

      var values = lodashStable.map(fitzModifiers, function(modifier) {
        return raisedHand + modifier;
      });

      var expected = lodashStable.map(values, function(value) {
        return [1, [value], [value]];
      });

      var actual = lodashStable.map(values, function(value) {
        return [_.size(value), _.toArray(value), _.words(value)];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should match lone surrogates', function(assert) {
      assert.expect(3);

      var pair = hearts.split(''),
          surrogates = pair[0] + ' ' + pair[1];

      assert.strictEqual(_.size(surrogates), 3);
      assert.deepEqual(_.toArray(surrogates), [pair[0], ' ', pair[1]]);
      assert.deepEqual(_.words(surrogates), []);
    });

    QUnit.test('should match side by side fitzpatrick modifiers separately ', function(assert) {
      assert.expect(1);

      var string = fitzModifiers[0] + fitzModifiers[0];
      assert.deepEqual(_.toArray(string), [fitzModifiers[0], fitzModifiers[0]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.unary');

  (function() {
    function fn() {
      return slice.call(arguments);
    }

    QUnit.test('should cap the number of arguments provided to `func`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(['6', '8', '10'], _.unary(parseInt));
      assert.deepEqual(actual, [6, 8, 10]);
    });

    QUnit.test('should not force a minimum argument count', function(assert) {
      assert.expect(1);

      var capped = _.unary(fn);
      assert.deepEqual(capped(), []);
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(1);

      var capped = _.unary(function(a, b) { return this; }),
          object = { 'capped': capped };

      assert.strictEqual(object.capped(), object);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.unescape');

  (function() {
    var escaped = '&amp;&lt;&gt;&quot;&#39;\/',
        unescaped = '&<>"\'\/';

    escaped += escaped;
    unescaped += unescaped;

    QUnit.test('should unescape entities in order', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.unescape('&amp;lt;'), '&lt;');
    });

    QUnit.test('should unescape the proper entities', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.unescape(escaped), unescaped);
    });

    QUnit.test('should not unescape the "&#x2F;" entity', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.unescape('&#x2F;'), '&#x2F;');
    });

    QUnit.test('should handle strings with nothing to unescape', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.unescape('abc'), 'abc');
    });

    QUnit.test('should unescape the same characters escaped by `_.escape`', function(assert) {
      assert.expect(1);

      assert.strictEqual(_.unescape(_.escape(unescaped)), unescaped);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('union methods');

  lodashStable.each(['union', 'unionBy', 'unionWith'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        func = _[methodName];

    QUnit.test('`_.' + methodName + '` should return the union of two arrays', function(assert) {
      assert.expect(1);

      var actual = func([2], [1, 2]);
      assert.deepEqual(actual, [2, 1]);
    });

    QUnit.test('`_.' + methodName + '` should return the union of multiple arrays', function(assert) {
      assert.expect(1);

      var actual = func([2], [1, 2], [2, 3]);
      assert.deepEqual(actual, [2, 1, 3]);
    });

    QUnit.test('`_.' + methodName + '` should not flatten nested arrays', function(assert) {
      assert.expect(1);

      var actual = func([1, 3, 2], [1, [5]], [2, [4]]);
      assert.deepEqual(actual, [1, 3, 2, [5], [4]]);
    });

    QUnit.test('`_.' + methodName + '` should ignore values that are not arrays or `arguments` objects', function(assert) {
      assert.expect(3);

      var array = [0];
      assert.deepEqual(func(array, 3, { '0': 1 }, null), array);
      assert.deepEqual(func(null, array, null, [2, 1]), [0, 2, 1]);
      assert.deepEqual(func(array, null, args, null), [0, 1, 2, 3]);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.unionBy');

  (function() {
    QUnit.test('should accept an `iteratee` argument', function(assert) {
      assert.expect(2);

      var actual = _.unionBy([2.1], [1.2, 2.3], Math.floor);
      assert.deepEqual(actual, [2.1, 1.2]);

      actual = _.unionBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
      assert.deepEqual(actual, [{ 'x': 1 }, { 'x': 2 }]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.unionBy([2.1], [1.2, 2.3], function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [2.1]);
    });

    QUnit.test('should output values from the first possible array', function(assert) {
      assert.expect(1);

      var actual = _.unionBy([{ 'x': 1, 'y': 1 }], [{ 'x': 1, 'y': 2 }], 'x');
      assert.deepEqual(actual, [{ 'x': 1, 'y': 1 }]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.unionWith');

  (function() {
    QUnit.test('should work with a `comparator` argument', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }],
          others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }],
          actual = _.unionWith(objects, others, lodashStable.isEqual);

      assert.deepEqual(actual, [objects[0], objects[1], others[0]]);
    });

    QUnit.test('should output values from the first possible array', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 1, 'y': 1 }],
          others = [{ 'x': 1, 'y': 2 }];

      var actual = _.unionWith(objects, others, function(a, b) {
        return a.x == b.x;
      });

      assert.deepEqual(actual, [{ 'x': 1, 'y': 1 }]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('uniq methods');

  lodashStable.each(['uniq', 'uniqBy', 'uniqWith', 'sortedUniq', 'sortedUniqBy'], function(methodName) {
    var func = _[methodName],
        isSorted = /^sorted/.test(methodName),
        objects = [{ 'a': 2 }, { 'a': 3 }, { 'a': 1 }, { 'a': 2 }, { 'a': 3 }, { 'a': 1 }];

    if (isSorted) {
      objects = _.sortBy(objects, 'a');
    }
    else {
      QUnit.test('`_.' + methodName + '` should return unique values of an unsorted array', function(assert) {
        assert.expect(1);

        var array = [2, 1, 2];
        assert.deepEqual(func(array), [2, 1]);
      });
    }
    QUnit.test('`_.' + methodName + '` should return unique values of a sorted array', function(assert) {
      assert.expect(1);

      var array = [1, 2, 2];
      assert.deepEqual(func(array), [1, 2]);
    });

    QUnit.test('`_.' + methodName + '` should treat object instances as unique', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(objects), objects);
    });

    QUnit.test('`_.' + methodName + '` should treat `-0` as `0`', function(assert) {
      assert.expect(1);

      var actual = lodashStable.map(func([-0, 0]), lodashStable.toString);
      assert.deepEqual(actual, ['0']);
    });

    QUnit.test('`_.' + methodName + '` should match `NaN`', function(assert) {
      assert.expect(1);

      assert.deepEqual(func([NaN, NaN]), [NaN]);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays', function(assert) {
      assert.expect(1);

      var largeArray = [],
          expected = [0, {}, 'a'],
          count = Math.ceil(LARGE_ARRAY_SIZE / expected.length);

      lodashStable.each(expected, function(value) {
        lodashStable.times(count, function() {
          largeArray.push(value);
        });
      });

      assert.deepEqual(func(largeArray), expected);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of `-0` as `0`', function(assert) {
      assert.expect(1);

      var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, function(index) {
        return isEven(index) ? -0 : 0;
      });

      var actual = lodashStable.map(func(largeArray), lodashStable.toString);
      assert.deepEqual(actual, ['0']);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of boolean, `NaN`, and nullish values', function(assert) {
      assert.expect(1);

      var largeArray = [],
          expected = [null, undefined, false, true, NaN],
          count = Math.ceil(LARGE_ARRAY_SIZE / expected.length);

      lodashStable.each(expected, function(value) {
        lodashStable.times(count, function() {
          largeArray.push(value);
        });
      });

      assert.deepEqual(func(largeArray), expected);
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of symbols', function(assert) {
      assert.expect(1);

      if (Symbol) {
        var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, Symbol);
        assert.deepEqual(func(largeArray), largeArray);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should work with large arrays of well-known symbols', function(assert) {
      assert.expect(1);

      // See http://www.ecma-international.org/ecma-262/6.0/#sec-well-known-symbols.
      if (Symbol) {
        var expected = [
          Symbol.hasInstance, Symbol.isConcatSpreadable, Symbol.iterator,
          Symbol.match, Symbol.replace, Symbol.search, Symbol.species,
          Symbol.split, Symbol.toPrimitive, Symbol.toStringTag, Symbol.unscopables
        ];

        var largeArray = [],
            count = Math.ceil(LARGE_ARRAY_SIZE / expected.length);

        expected = lodashStable.map(expected, function(symbol) {
          return symbol || {};
        });

        lodashStable.each(expected, function(value) {
          lodashStable.times(count, function() {
            largeArray.push(value);
          });
        });

        assert.deepEqual(func(largeArray), expected);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should distinguish between numbers and numeric strings', function(assert) {
      assert.expect(1);

      var largeArray = [],
          expected = ['2', 2, Object('2'), Object(2)],
          count = Math.ceil(LARGE_ARRAY_SIZE / expected.length);

      lodashStable.each(expected, function(value) {
        lodashStable.times(count, function() {
          largeArray.push(value);
        });
      });

      assert.deepEqual(func(largeArray), expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.uniq');

  (function() {
    QUnit.test('should perform an unsorted uniq when used as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var array = [[2, 1, 2], [1, 2, 1]],
          actual = lodashStable.map(array, lodashStable.uniq);

      assert.deepEqual(actual, [[2, 1], [1, 2]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('uniqBy methods');

  lodashStable.each(['uniqBy', 'sortedUniqBy'], function(methodName) {
    var func = _[methodName],
        isSorted = methodName == 'sortedUniqBy',
        objects = [{ 'a': 2 }, { 'a': 3 }, { 'a': 1 }, { 'a': 2 }, { 'a': 3 }, { 'a': 1 }];

    if (isSorted) {
      objects = _.sortBy(objects, 'a');
    }
    QUnit.test('`_.' + methodName + '` should work with an `iteratee` argument', function(assert) {
      assert.expect(1);

      var expected = isSorted ? [{ 'a': 1 }, { 'a': 2 }, { 'a': 3 }] : objects.slice(0, 3);

      var actual = func(objects, function(object) {
        return object.a;
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should work with large arrays', function(assert) {
      assert.expect(2);

      var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, function() {
        return [1, 2];
      });

      var actual = func(largeArray, String);
      assert.strictEqual(actual[0], largeArray[0]);
      assert.deepEqual(actual, [[1, 2]]);
    });

    QUnit.test('`_.' + methodName + '` should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      func(objects, function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [objects[0]]);
    });

    QUnit.test('`_.' + methodName + '` should work with `_.property` shorthands', function(assert) {
      assert.expect(2);

      var expected = isSorted ? [{ 'a': 1 }, { 'a': 2 }, { 'a': 3 }] : objects.slice(0, 3),
          actual = func(objects, 'a');

      assert.deepEqual(actual, expected);

      var arrays = [[2], [3], [1], [2], [3], [1]];
      if (isSorted) {
        arrays = lodashStable.sortBy(arrays, 0);
      }
      expected = isSorted ? [[1], [2], [3]] : arrays.slice(0, 3);
      actual = func(arrays, 0);

      assert.deepEqual(actual, expected);
    });

    lodashStable.each({
      'an array': [0, 'a'],
      'an object': { '0': 'a' },
      'a number': 0,
      'a string': '0'
    },
    function(iteratee, key) {
      QUnit.test('`_.' + methodName + '` should work with ' + key + ' for `iteratee`', function(assert) {
        assert.expect(1);

        var actual = func([['a'], ['a'], ['b']], iteratee);
        assert.deepEqual(actual, [['a'], ['b']]);
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.uniqWith');

  (function() {
    QUnit.test('should work with a `comparator` argument', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }, { 'x': 1, 'y': 2 }],
          actual = _.uniqWith(objects, lodashStable.isEqual);

      assert.deepEqual(actual, [objects[0], objects[1]]);
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var largeArray = lodashStable.times(LARGE_ARRAY_SIZE, function(index) {
        return isEven(index) ? -0 : 0;
      });

      var arrays = [[-0, 0], largeArray],
          expected = lodashStable.map(arrays, lodashStable.constant(['-0']));

      var actual = lodashStable.map(arrays, function(array) {
        return lodashStable.map(_.uniqWith(array, lodashStable.eq), lodashStable.toString);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.uniqueId');

  (function() {
    QUnit.test('should generate unique ids', function(assert) {
      assert.expect(1);

      var actual = lodashStable.times(1000, function(assert) {
        return _.uniqueId();
      });

      assert.strictEqual(lodashStable.uniq(actual).length, actual.length);
    });

    QUnit.test('should return a string value when not providing a prefix argument', function(assert) {
      assert.expect(1);

      assert.strictEqual(typeof _.uniqueId(), 'string');
    });

    QUnit.test('should coerce the prefix argument to a string', function(assert) {
      assert.expect(1);

      var actual = [_.uniqueId(3), _.uniqueId(2), _.uniqueId(1)];
      assert.ok(/3\d+,2\d+,1\d+/.test(actual));
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.unset');

  (function() {
    QUnit.test('should unset property values', function(assert) {
      assert.expect(4);

      lodashStable.each(['a', ['a']], function(path) {
        var object = { 'a': 1, 'c': 2 };
        assert.strictEqual(_.unset(object, path), true);
        assert.deepEqual(object, { 'c': 2 });
      });
    });

    QUnit.test('should preserve the sign of `0`', function(assert) {
      assert.expect(1);

      var props = [-0, Object(-0), 0, Object(0)],
          expected = lodashStable.map(props, lodashStable.constant([true, false]));

      var actual = lodashStable.map(props, function(key) {
        var object = { '-0': 'a', '0': 'b' };
        return [_.unset(object, key), lodashStable.toString(key) in object];
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should unset symbol keyed property values', function(assert) {
      assert.expect(2);

      if (Symbol) {
        var object = {};
        object[symbol] = 1;

        assert.strictEqual(_.unset(object, symbol), true);
        assert.notOk(symbol in object);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should unset deep property values', function(assert) {
      assert.expect(4);

      lodashStable.each(['a.b', ['a', 'b']], function(path) {
        var object = { 'a': { 'b': null } };
        assert.strictEqual(_.unset(object, path), true);
        assert.deepEqual(object, { 'a': {} });
      });
    });

    QUnit.test('should handle complex paths', function(assert) {
      assert.expect(4);

      var paths = [
        'a[-1.23]["[\\"b\\"]"].c[\'[\\\'d\\\']\'][\ne\n][f].g',
        ['a', '-1.23', '["b"]', 'c', "['d']", '\ne\n', 'f', 'g']
      ];

      lodashStable.each(paths, function(path) {
        var object = { 'a': { '-1.23': { '["b"]': { 'c': { "['d']": { '\ne\n': { 'f': { 'g': 8 } } } } } } } };
        assert.strictEqual(_.unset(object, path), true);
        assert.notOk('g' in object.a[-1.23]['["b"]'].c["['d']"]['\ne\n'].f);
      });
    });

    QUnit.test('should return `true` for nonexistent paths', function(assert) {
      assert.expect(5);

      var object = { 'a': { 'b': { 'c': null } } };

      lodashStable.each(['z', 'a.z', 'a.b.z', 'a.b.c.z'], function(path) {
        assert.strictEqual(_.unset(object, path), true);
      });

      assert.deepEqual(object, { 'a': { 'b': { 'c': null } } });
    });

    QUnit.test('should not error when `object` is nullish', function(assert) {
      assert.expect(1);

      var values = [null, undefined],
          expected = [[true, true], [true, true]];

      var actual = lodashStable.map(values, function(value) {
        try {
          return [_.unset(value, 'a.b'), _.unset(value, ['a', 'b'])];
        } catch (e) {
          return e.message;
        }
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should follow `path` over non-plain objects', function(assert) {
      assert.expect(8);

      var object = { 'a': '' },
          paths = ['constructor.prototype.a', ['constructor', 'prototype', 'a']];

      lodashStable.each(paths, function(path) {
        numberProto.a = 1;

        var actual = _.unset(0, path);
        assert.strictEqual(actual, true);
        assert.notOk('a' in numberProto);

        delete numberProto.a;
      });

      lodashStable.each(['a.replace.b', ['a', 'replace', 'b']], function(path) {
        stringProto.replace.b = 1;

        var actual = _.unset(object, path);
        assert.strictEqual(actual, true);
        assert.notOk('a' in stringProto.replace);

        delete stringProto.replace.b;
      });
    });

    QUnit.test('should return `false` for non-configurable properties', function(assert) {
      assert.expect(1);

      var object = {};

      if (!isStrict) {
        defineProperty(object, 'a', {
          'configurable': false,
          'enumerable': true,
          'writable': true,
          'value': 1,
        });
        assert.strictEqual(_.unset(object, 'a'), false);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.unzipWith');

  (function() {
    QUnit.test('should unzip arrays combining regrouped elements with `iteratee`', function(assert) {
      assert.expect(1);

      var array = [[1, 4], [2, 5], [3, 6]];

      var actual = _.unzipWith(array, function(a, b, c) {
        return a + b + c;
      });

      assert.deepEqual(actual, [6, 15]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.unzipWith([[1, 3, 5], [2, 4, 6]], function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [1, 2]);
    });

    QUnit.test('should perform a basic unzip when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var array = [[1, 3], [2, 4]],
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant(_.unzip(array)));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.unzipWith(array, value) : _.unzipWith(array);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.updateWith');

  (function() {
    QUnit.test('should work with a `customizer` callback', function(assert) {
      assert.expect(1);

      var actual = _.updateWith({ '0': {} }, '[0][1][2]', stubThree, function(value) {
        return lodashStable.isObject(value) ? undefined : {};
      });

      assert.deepEqual(actual, { '0': { '1': { '2': 3 } } });
    });

    QUnit.test('should work with a `customizer` that returns `undefined`', function(assert) {
      assert.expect(1);

      var actual = _.updateWith({}, 'a[0].b.c', stubFour, noop);
      assert.deepEqual(actual, { 'a': [{ 'b': { 'c': 4 } }] });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('update methods');

  lodashStable.each(['update', 'updateWith'], function(methodName) {
    var func = _[methodName],
        oldValue = 1;

    QUnit.test('`_.' + methodName + '` should invoke `updater` with the value on `path` of `object`', function(assert) {
      assert.expect(4);

      var object = { 'a': [{ 'b': { 'c': oldValue } }] },
          expected = oldValue + 1;

      lodashStable.each(['a[0].b.c', ['a', '0', 'b', 'c']], function(path) {
        func(object, path, function(n) {
          assert.strictEqual(n, oldValue);
          return ++n;
        });

        assert.strictEqual(object.a[0].b.c, expected);
        object.a[0].b.c = oldValue;
      });
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.upperCase');

  (function() {
    QUnit.test('should uppercase as space-separated words', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.upperCase('--foo-bar--'), 'FOO BAR');
      assert.strictEqual(_.upperCase('fooBar'), 'FOO BAR');
      assert.strictEqual(_.upperCase('__foo_bar__'), 'FOO BAR');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.upperFirst');

  (function() {
    QUnit.test('should uppercase only the first character', function(assert) {
      assert.expect(3);

      assert.strictEqual(_.upperFirst('fred'), 'Fred');
      assert.strictEqual(_.upperFirst('Fred'), 'Fred');
      assert.strictEqual(_.upperFirst('FRED'), 'FRED');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('values methods');

  lodashStable.each(['values', 'valuesIn'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        strictArgs = (function() { 'use strict'; return arguments; }(1, 2, 3)),
        func = _[methodName],
        isValues = methodName == 'values';

    QUnit.test('`_.' + methodName + '` should get string keyed values of `object`', function(assert) {
      assert.expect(1);

      var object = { 'a': 1, 'b': 2 },
          actual = func(object).sort();

      assert.deepEqual(actual, [1, 2]);
    });

    QUnit.test('`_.' + methodName + '` should work with an object that has a `length` property', function(assert) {
      assert.expect(1);

      var object = { '0': 'a', '1': 'b', 'length': 2 },
          actual = func(object).sort();

      assert.deepEqual(actual, [2, 'a', 'b']);
    });

    QUnit.test('`_.' + methodName + '` should ' + (isValues ? 'not ' : '') + 'include inherited string keyed property values', function(assert) {
      assert.expect(1);

      function Foo() {
        this.a = 1;
      }
      Foo.prototype.b = 2;

      var expected = isValues ? [1] : [1, 2],
          actual = func(new Foo).sort();

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should work with `arguments` objects', function(assert) {
      assert.expect(1);

      var values = [args, strictArgs],
          expected = lodashStable.map(values, lodashStable.constant([1, 2, 3]));

      var actual = lodashStable.map(values, function(value) {
        return func(value).sort();
      });

      assert.deepEqual(actual, expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.without');

  (function() {
    QUnit.test('should return the difference of values', function(assert) {
      assert.expect(1);

      var actual = _.without([2, 1, 2, 3], 1, 2);
      assert.deepEqual(actual, [3]);
    });

    QUnit.test('should use strict equality to determine the values to reject', function(assert) {
      assert.expect(2);

      var object1 = { 'a': 1 },
          object2 = { 'b': 2 },
          array = [object1, object2];

      assert.deepEqual(_.without(array, { 'a': 1 }), array);
      assert.deepEqual(_.without(array, object1), [object2]);
    });

    QUnit.test('should remove all occurrences of each value from an array', function(assert) {
      assert.expect(1);

      var array = [1, 2, 3, 1, 2, 3];
      assert.deepEqual(_.without(array, 1, 2), [3, 3]);
    });
  }(1, 2, 3));

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.words');

  (function() {
    QUnit.test('should match words containing Latin-1 Supplement letters', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(burredLetters, function(letter) {
        return [letter];
      });

      var actual = lodashStable.map(burredLetters, function(letter) {
        return _.words(letter);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not treat mathematical operators as words', function(assert) {
      assert.expect(1);

      var operators = ['\xac', '\xb1', '\xd7', '\xf7'],
          expected = lodashStable.map(operators, stubArray),
          actual = lodashStable.map(operators, _.words);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should not treat punctuation as words', function(assert) {
      assert.expect(1);

      var marks = [
        '\u2012', '\u2013', '\u2014', '\u2015',
        '\u2024', '\u2025', '\u2026',
        '\u205d', '\u205e'
      ];

      var expected = lodashStable.map(marks, stubArray),
          actual = lodashStable.map(marks, _.words);

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should support a `pattern` argument', function(assert) {
      assert.expect(2);

      assert.deepEqual(_.words('abcd', /ab|cd/g), ['ab', 'cd']);
      assert.deepEqual(_.words('abcd', 'ab|cd'), ['ab']);
    });

    QUnit.test('should work with compound words', function(assert) {
      assert.expect(12);

      assert.deepEqual(_.words('12Feet'), ['12', 'Feet']);
      assert.deepEqual(_.words('aeiouAreVowels'), ['aeiou', 'Are', 'Vowels']);
      assert.deepEqual(_.words('enable 6h format'), ['enable', '6', 'h', 'format']);
      assert.deepEqual(_.words('enable 24H format'), ['enable', '24', 'H', 'format']);
      assert.deepEqual(_.words('isISO8601'), ['is', 'ISO', '8601']);
      assert.deepEqual(_.words('LETTERSAeiouAreVowels'), ['LETTERS', 'Aeiou', 'Are', 'Vowels']);
      assert.deepEqual(_.words('tooLegit2Quit'), ['too', 'Legit', '2', 'Quit']);
      assert.deepEqual(_.words('walk500Miles'), ['walk', '500', 'Miles']);
      assert.deepEqual(_.words('xhr2Request'), ['xhr', '2', 'Request']);
      assert.deepEqual(_.words('XMLHttp'), ['XML', 'Http']);
      assert.deepEqual(_.words('XmlHTTP'), ['Xml', 'HTTP']);
      assert.deepEqual(_.words('XmlHttp'), ['Xml', 'Http']);
    });

    QUnit.test('should work with compound words containing diacritical marks', function(assert) {
      assert.expect(3);

      assert.deepEqual(_.words('LETTERSÆiouAreVowels'), ['LETTERS', 'Æiou', 'Are', 'Vowels']);
      assert.deepEqual(_.words('æiouAreVowels'), ['æiou', 'Are', 'Vowels']);
      assert.deepEqual(_.words('æiou2Consonants'), ['æiou', '2', 'Consonants']);
    });

    QUnit.test('should work with contractions', function(assert) {
      assert.expect(2);

      var postfixes = ['d', 'll', 'm', 're', 's', 't', 've'];

      lodashStable.each(["'", '\u2019'], function(apos) {
        var actual = lodashStable.map(postfixes, function(postfix) {
          return _.words('a b' + apos + postfix +  ' c');
        });

        var expected = lodashStable.map(postfixes, function(postfix) {
          return ['a', 'b' + apos + postfix, 'c'];
        });

        assert.deepEqual(actual, expected);
      });
    });

    QUnit.test('should work as an iteratee for methods like `_.map`', function(assert) {
      assert.expect(1);

      var strings = lodashStable.map(['a', 'b', 'c'], Object),
          actual = lodashStable.map(strings, _.words);

      assert.deepEqual(actual, [['a'], ['b'], ['c']]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.wrap');

  (function() {
    QUnit.test('should create a wrapped function', function(assert) {
      assert.expect(1);

      var p = _.wrap(_.escape, function(func, text) {
        return '<p>' + func(text) + '</p>';
      });

      assert.strictEqual(p('fred, barney, & pebbles'), '<p>fred, barney, &amp; pebbles</p>');
    });

    QUnit.test('should provide correct `wrapper` arguments', function(assert) {
      assert.expect(1);

      var args;

      var wrapped = _.wrap(noop, function() {
        args || (args = slice.call(arguments));
      });

      wrapped(1, 2, 3);
      assert.deepEqual(args, [noop, 1, 2, 3]);
    });

    QUnit.test('should use `_.identity` when `wrapper` is nullish', function(assert) {
      assert.expect(1);

      var values = [, null, undefined],
          expected = lodashStable.map(values, stubA);

      var actual = lodashStable.map(values, function(value, index) {
        var wrapped = index ? _.wrap('a', value) : _.wrap('a');
        return wrapped('b', 'c');
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(1);

      var p = _.wrap(_.escape, function(func) {
        return '<p>' + func(this.text) + '</p>';
      });

      var object = { 'p': p, 'text': 'fred, barney, & pebbles' };
      assert.strictEqual(object.p(), '<p>fred, barney, &amp; pebbles</p>');
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('xor methods');

  lodashStable.each(['xor', 'xorBy', 'xorWith'], function(methodName) {
    var args = (function() { return arguments; }(1, 2, 3)),
        func = _[methodName];

    QUnit.test('`_.' + methodName + '` should return the symmetric difference of two arrays', function(assert) {
      assert.expect(1);

      var actual = func([2, 1], [2, 3]);
      assert.deepEqual(actual, [1, 3]);
    });

    QUnit.test('`_.' + methodName + '` should return the symmetric difference of multiple arrays', function(assert) {
      assert.expect(1);

      var actual = func([2, 1], [2, 3], [3, 4]);
      assert.deepEqual(actual, [1, 4]);
    });

    QUnit.test('`_.' + methodName + '` should return an array of unique values', function(assert) {
      assert.expect(2);

      var actual = func([1, 1, 2, 5], [2, 2, 3, 5], [3, 4, 5, 5]);
      assert.deepEqual(actual, [1, 4, 5]);

      actual = func([1, 1]);
      assert.deepEqual(actual, [1]);
    });

    QUnit.test('`_.' + methodName + '` should return a new array when a single array is given', function(assert) {
      assert.expect(1);

      var array = [1];
      assert.notStrictEqual(func(array), array);
    });

    QUnit.test('`_.' + methodName + '` should ignore individual secondary arguments', function(assert) {
      assert.expect(1);

      var array = [0];
      assert.deepEqual(func(array, 3, null, { '0': 1 }), array);
    });

    QUnit.test('`_.' + methodName + '` should ignore values that are not arrays or `arguments` objects', function(assert) {
      assert.expect(3);

      var array = [1, 2];
      assert.deepEqual(func(array, 3, { '0': 1 }, null), array);
      assert.deepEqual(func(null, array, null, [2, 3]), [1, 3]);
      assert.deepEqual(func(array, null, args, null), [3]);
    });

    QUnit.test('`_.' + methodName + '` should return a wrapped value when chaining', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _([1, 2, 3])[methodName]([5, 2, 1, 4]);
        assert.ok(wrapped instanceof _);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('`_.' + methodName + '` should work when in a lazy sequence before `head` or `last`', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE + 1),
            wrapped = _(array).slice(1)[methodName]([LARGE_ARRAY_SIZE, LARGE_ARRAY_SIZE + 1]);

        var actual = lodashStable.map(['head', 'last'], function(methodName) {
          return wrapped[methodName]();
        });

        assert.deepEqual(actual, [1, LARGE_ARRAY_SIZE + 1]);
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.xorBy');

  (function() {
    QUnit.test('should accept an `iteratee` argument', function(assert) {
      assert.expect(2);

      var actual = _.xorBy([2.1, 1.2], [2.3, 3.4], Math.floor);
      assert.deepEqual(actual, [1.2, 3.4]);

      actual = _.xorBy([{ 'x': 1 }], [{ 'x': 2 }, { 'x': 1 }], 'x');
      assert.deepEqual(actual, [{ 'x': 2 }]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.xorBy([2.1, 1.2], [2.3, 3.4], function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [2.3]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.xorWith');

  (function() {
    QUnit.test('should work with a `comparator` argument', function(assert) {
      assert.expect(1);

      var objects = [{ 'x': 1, 'y': 2 }, { 'x': 2, 'y': 1 }],
          others = [{ 'x': 1, 'y': 1 }, { 'x': 1, 'y': 2 }],
          actual = _.xorWith(objects, others, lodashStable.isEqual);

      assert.deepEqual(actual, [objects[1], others[0]]);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('zipObject methods');

  lodashStable.each(['zipObject', 'zipObjectDeep'], function(methodName) {
    var func = _[methodName],
        object = { 'barney': 36, 'fred': 40 },
        isDeep = methodName == 'zipObjectDeep';

    QUnit.test('`_.' + methodName + '` should zip together key/value arrays into an object', function(assert) {
      assert.expect(1);

      var actual = func(['barney', 'fred'], [36, 40]);
      assert.deepEqual(actual, object);
    });

    QUnit.test('`_.' + methodName + '` should ignore extra `values`', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(['a'], [1, 2]), { 'a': 1 });
    });

    QUnit.test('`_.' + methodName + '` should assign `undefined` values for extra `keys`', function(assert) {
      assert.expect(1);

      assert.deepEqual(func(['a', 'b'], [1]), { 'a': 1, 'b': undefined });
    });

    QUnit.test('`_.' + methodName + '` should ' + (isDeep ? '' : 'not ') + 'support deep paths', function(assert) {
      assert.expect(2);

      lodashStable.each(['a.b.c', ['a', 'b', 'c']], function(path, index) {
        var expected = isDeep ? ({ 'a': { 'b': { 'c': 1 } } }) : (index ? { 'a,b,c': 1 } : { 'a.b.c': 1 });
        assert.deepEqual(func([path], [1]), expected);
      });
    });

    QUnit.test('`_.' + methodName + '` should work in a lazy sequence', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var values = lodashStable.range(LARGE_ARRAY_SIZE),
            props = lodashStable.map(values, function(value) { return 'key' + value; }),
            actual = _(props)[methodName](values).map(square).filter(isEven).take().value();

        assert.deepEqual(actual, _.take(_.filter(_.map(func(props, values), square), isEven)));
      }
      else {
        skipAssert(assert);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.zipWith');

  (function() {
    QUnit.test('should zip arrays combining grouped elements with `iteratee`', function(assert) {
      assert.expect(2);

      var array1 = [1, 2, 3],
          array2 = [4, 5, 6],
          array3 = [7, 8, 9];

      var actual = _.zipWith(array1, array2, array3, function(a, b, c) {
        return a + b + c;
      });

      assert.deepEqual(actual, [12, 15, 18]);

      var actual = _.zipWith(array1, [], function(a, b) {
        return a + (b || 0);
      });

      assert.deepEqual(actual, [1, 2, 3]);
    });

    QUnit.test('should provide correct `iteratee` arguments', function(assert) {
      assert.expect(1);

      var args;

      _.zipWith([1, 2], [3, 4], [5, 6], function() {
        args || (args = slice.call(arguments));
      });

      assert.deepEqual(args, [1, 3, 5]);
    });

    QUnit.test('should perform a basic zip when `iteratee` is nullish', function(assert) {
      assert.expect(1);

      var array1 = [1, 2],
          array2 = [3, 4],
          values = [, null, undefined],
          expected = lodashStable.map(values, lodashStable.constant(_.zip(array1, array2)));

      var actual = lodashStable.map(values, function(value, index) {
        return index ? _.zipWith(array1, array2, value) : _.zipWith(array1, array2);
      });

      assert.deepEqual(actual, expected);
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash.unzip and lodash.zip');

  lodashStable.each(['unzip', 'zip'], function(methodName, index) {
    var func = _[methodName];
    func = lodashStable.bind(index ? func.apply : func.call, func, null);

    var object = {
      'an empty array': [
        [],
        []
      ],
      '0-tuples': [
        [[], []],
        []
      ],
      '2-tuples': [
        [['barney', 'fred'], [36, 40]],
        [['barney', 36], ['fred', 40]]
      ],
      '3-tuples': [
        [['barney', 'fred'], [36, 40], [false, true]],
        [['barney', 36, false], ['fred', 40, true]]
      ]
    };

    lodashStable.forOwn(object, function(pair, key) {
      QUnit.test('`_.' + methodName + '` should work with ' + key, function(assert) {
        assert.expect(2);

        var actual = func(pair[0]);
        assert.deepEqual(actual, pair[1]);
        assert.deepEqual(func(actual), actual.length ? pair[0] : []);
      });
    });

    QUnit.test('`_.' + methodName + '` should work with tuples of different lengths', function(assert) {
      assert.expect(4);

      var pair = [
        [['barney', 36], ['fred', 40, false]],
        [['barney', 'fred'], [36, 40], [undefined, false]]
      ];

      var actual = func(pair[0]);
      assert.ok('0' in actual[2]);
      assert.deepEqual(actual, pair[1]);

      actual = func(actual);
      assert.ok('2' in actual[0]);
      assert.deepEqual(actual, [['barney', 36, undefined], ['fred', 40, false]]);
    });

    QUnit.test('`_.' + methodName + '` should treat falsey values as empty arrays', function(assert) {
      assert.expect(1);

      var expected = lodashStable.map(falsey, stubArray);

      var actual = lodashStable.map(falsey, function(value) {
        return func([value, value, value]);
      });

      assert.deepEqual(actual, expected);
    });

    QUnit.test('`_.' + methodName + '` should ignore values that are not arrays or `arguments` objects', function(assert) {
      assert.expect(1);

      var array = [[1, 2], [3, 4], null, undefined, { '0': 1 }];
      assert.deepEqual(func(array), [[1, 3], [2, 4]]);
    });

    QUnit.test('`_.' + methodName + '` should support consuming its return value', function(assert) {
      assert.expect(1);

      var expected = [['barney', 'fred'], [36, 40]];
      assert.deepEqual(func(func(func(func(expected)))), expected);
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).commit');

  (function() {
    QUnit.test('should execute the chained sequence and returns the wrapped result', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var array = [1],
            wrapped = _(array).push(2).push(3);

        assert.deepEqual(array, [1]);

        var otherWrapper = wrapped.commit();
        assert.ok(otherWrapper instanceof _);
        assert.deepEqual(otherWrapper.value(), [1, 2, 3]);
        assert.deepEqual(wrapped.value(), [1, 2, 3, 2, 3]);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should track the `__chain__` value of a wrapper', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var wrapped = _([1]).chain().commit().head();
        assert.ok(wrapped instanceof _);
        assert.strictEqual(wrapped.value(), 1);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).next');

  lodashStable.each([false, true], function(implict) {
    function chain(value) {
      return implict ? _(value) : _.chain(value);
    }

    var chainType = 'in an ' + (implict ? 'implict' : 'explict') + ' chain';

    QUnit.test('should follow the iterator protocol ' + chainType, function(assert) {
      assert.expect(3);

      if (!isNpm) {
        var wrapped = chain([1, 2]);

        assert.deepEqual(wrapped.next(), { 'done': false, 'value': 1 });
        assert.deepEqual(wrapped.next(), { 'done': false, 'value': 2 });
        assert.deepEqual(wrapped.next(), { 'done': true,  'value': undefined });
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should act as an iterable ' + chainType, function(assert) {
      assert.expect(2);

      if (!isNpm && Symbol && Symbol.iterator) {
        var array = [1, 2],
            wrapped = chain(array);

        assert.strictEqual(wrapped[Symbol.iterator](), wrapped);
        assert.deepEqual(lodashStable.toArray(wrapped), array);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should use `_.toArray` to generate the iterable result ' + chainType, function(assert) {
      assert.expect(3);

      if (!isNpm && Array.from) {
        var hearts = '\ud83d\udc95',
            values = [[1], { 'a': 1 }, hearts];

        lodashStable.each(values, function(value) {
          var wrapped = chain(value);
          assert.deepEqual(Array.from(wrapped), _.toArray(value));
        });
      }
      else {
        skipAssert(assert, 3);
      }
    });

    QUnit.test('should reset the iterator correctly ' + chainType, function(assert) {
      assert.expect(4);

      if (!isNpm && Symbol && Symbol.iterator) {
        var array = [1, 2],
            wrapped = chain(array);

        assert.deepEqual(lodashStable.toArray(wrapped), array);
        assert.deepEqual(lodashStable.toArray(wrapped), [], 'produces an empty array for exhausted iterator');

        var other = wrapped.filter();
        assert.deepEqual(lodashStable.toArray(other), array, 'reset for new chain segments');
        assert.deepEqual(lodashStable.toArray(wrapped), [], 'iterator is still exhausted');
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should work in a lazy sequence ' + chainType, function(assert) {
      assert.expect(3);

      if (!isNpm && Symbol && Symbol.iterator) {
        var array = lodashStable.range(LARGE_ARRAY_SIZE),
            predicate = function(value) { values.push(value); return isEven(value); },
            values = [],
            wrapped = chain(array);

        assert.deepEqual(lodashStable.toArray(wrapped), array);

        wrapped = wrapped.filter(predicate);
        assert.deepEqual(lodashStable.toArray(wrapped), _.filter(array, isEven), 'reset for new lazy chain segments');
        assert.deepEqual(values, array, 'memoizes iterator values');
      }
      else {
        skipAssert(assert, 3);
      }
    });
  });

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).plant');

  (function() {
    QUnit.test('should clone the chained sequence planting `value` as the wrapped value', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var array1 = [5, null, 3, null, 1],
            array2 = [10, null, 8, null, 6],
            wrapped1 = _(array1).thru(_.compact).map(square).takeRight(2).sort(),
            wrapped2 = wrapped1.plant(array2);

        assert.deepEqual(wrapped2.value(), [36, 64]);
        assert.deepEqual(wrapped1.value(), [1, 9]);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should clone `chainAll` settings', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var array1 = [2, 4],
            array2 = [6, 8],
            wrapped1 = _(array1).chain().map(square),
            wrapped2 = wrapped1.plant(array2);

        assert.deepEqual(wrapped2.head().value(), 36);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should reset iterator data on cloned sequences', function(assert) {
      assert.expect(3);

      if (!isNpm && Symbol && Symbol.iterator) {
        var array1 = [2, 4],
            array2 = [6, 8],
            wrapped1 = _(array1).map(square);

        assert.deepEqual(lodashStable.toArray(wrapped1), [4, 16]);
        assert.deepEqual(lodashStable.toArray(wrapped1), []);

        var wrapped2 = wrapped1.plant(array2);
        assert.deepEqual(lodashStable.toArray(wrapped2), [36, 64]);
      }
      else {
        skipAssert(assert, 3);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).pop');

  (function() {
    QUnit.test('should remove elements from the end of `array`', function(assert) {
      assert.expect(5);

      if (!isNpm) {
        var array = [1, 2],
            wrapped = _(array);

        assert.strictEqual(wrapped.pop(), 2);
        assert.deepEqual(wrapped.value(), [1]);
        assert.strictEqual(wrapped.pop(), 1);

        var actual = wrapped.value();
        assert.strictEqual(actual, array);
        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 5);
      }
    });

    QUnit.test('should accept falsey arguments', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var expected = lodashStable.map(falsey, stubTrue);

        var actual = lodashStable.map(falsey, function(value, index) {
          try {
            var result = index ? _(value).pop() : _().pop();
            return result === undefined;
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).push');

  (function() {
    QUnit.test('should append elements to `array`', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var array = [1],
            wrapped = _(array).push(2, 3),
            actual = wrapped.value();

        assert.strictEqual(actual, array);
        assert.deepEqual(actual, [1, 2, 3]);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should accept falsey arguments', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var expected = lodashStable.map(falsey, stubTrue);

        var actual = lodashStable.map(falsey, function(value, index) {
          try {
            var result = index ? _(value).push(1).value() : _().push(1).value();
            return lodashStable.eq(result, value);
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).shift');

  (function() {
    QUnit.test('should remove elements from the front of `array`', function(assert) {
      assert.expect(5);

      if (!isNpm) {
        var array = [1, 2],
            wrapped = _(array);

        assert.strictEqual(wrapped.shift(), 1);
        assert.deepEqual(wrapped.value(), [2]);
        assert.strictEqual(wrapped.shift(), 2);

        var actual = wrapped.value();
        assert.strictEqual(actual, array);
        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 5);
      }
    });

    QUnit.test('should accept falsey arguments', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var expected = lodashStable.map(falsey, stubTrue);

        var actual = lodashStable.map(falsey, function(value, index) {
          try {
            var result = index ? _(value).shift() : _().shift();
            return result === undefined;
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).sort');

  (function() {
    QUnit.test('should return the wrapped sorted `array`', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var array = [3, 1, 2],
            wrapped = _(array).sort(),
            actual = wrapped.value();

        assert.strictEqual(actual, array);
        assert.deepEqual(actual, [1, 2, 3]);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should accept falsey arguments', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var expected = lodashStable.map(falsey, stubTrue);

        var actual = lodashStable.map(falsey, function(value, index) {
          try {
            var result = index ? _(value).sort().value() : _().sort().value();
            return lodashStable.eq(result, value);
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).splice');

  (function() {
    QUnit.test('should support removing and inserting elements', function(assert) {
      assert.expect(5);

      if (!isNpm) {
        var array = [1, 2],
            wrapped = _(array);

        assert.deepEqual(wrapped.splice(1, 1, 3).value(), [2]);
        assert.deepEqual(wrapped.value(), [1, 3]);
        assert.deepEqual(wrapped.splice(0, 2).value(), [1, 3]);

        var actual = wrapped.value();
        assert.strictEqual(actual, array);
        assert.deepEqual(actual, []);
      }
      else {
        skipAssert(assert, 5);
      }
    });

    QUnit.test('should accept falsey arguments', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var expected = lodashStable.map(falsey, stubTrue);

        var actual = lodashStable.map(falsey, function(value, index) {
          try {
            var result = index ? _(value).splice(0, 1).value() : _().splice(0, 1).value();
            return lodashStable.isEqual(result, []);
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).unshift');

  (function() {
    QUnit.test('should prepend elements to `array`', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var array = [3],
            wrapped = _(array).unshift(1, 2),
            actual = wrapped.value();

        assert.strictEqual(actual, array);
        assert.deepEqual(actual, [1, 2, 3]);
      }
      else {
        skipAssert(assert, 2);
      }
    });

    QUnit.test('should accept falsey arguments', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var expected = lodashStable.map(falsey, stubTrue);

        var actual = lodashStable.map(falsey, function(value, index) {
          try {
            var result = index ? _(value).unshift(1).value() : _().unshift(1).value();
            return lodashStable.eq(result, value);
          } catch (e) {}
        });

        assert.deepEqual(actual, expected);
      }
      else {
        skipAssert(assert);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...).value');

  (function() {
    QUnit.test('should execute the chained sequence and extract the unwrapped value', function(assert) {
      assert.expect(4);

      if (!isNpm) {
        var array = [1],
            wrapped = _(array).push(2).push(3);

        assert.deepEqual(array, [1]);
        assert.deepEqual(wrapped.value(), [1, 2, 3]);
        assert.deepEqual(wrapped.value(), [1, 2, 3, 2, 3]);
        assert.deepEqual(array, [1, 2, 3, 2, 3]);
      }
      else {
        skipAssert(assert, 4);
      }
    });

    QUnit.test('should return the `valueOf` result of the wrapped value', function(assert) {
      assert.expect(1);

      if (!isNpm) {
        var wrapped = _(123);
        assert.strictEqual(Number(wrapped), 123);
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should stringify the wrapped value when used by `JSON.stringify`', function(assert) {
      assert.expect(1);

      if (!isNpm && JSON) {
        var wrapped = _([1, 2, 3]);
        assert.strictEqual(JSON.stringify(wrapped), '[1,2,3]');
      }
      else {
        skipAssert(assert);
      }
    });

    QUnit.test('should be aliased', function(assert) {
      assert.expect(2);

      if (!isNpm) {
        var expected = _.prototype.value;
        assert.strictEqual(_.prototype.toJSON, expected);
        assert.strictEqual(_.prototype.valueOf, expected);
      }
      else {
        skipAssert(assert, 2);
      }
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...) methods that return the wrapped modified array');

  (function() {
    var funcs = [
      'push',
      'reverse',
      'sort',
      'unshift'
    ];

    lodashStable.each(funcs, function(methodName) {
      QUnit.test('`_(...).' + methodName + '` should return a new wrapper', function(assert) {
        assert.expect(2);

        if (!isNpm) {
          var array = [1, 2, 3],
              wrapped = _(array),
              actual = wrapped[methodName]();

          assert.ok(actual instanceof _);
          assert.notStrictEqual(actual, wrapped);
        }
        else {
          skipAssert(assert, 2);
        }
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...) methods that return new wrapped values');

  (function() {
    var funcs = [
      'castArray',
      'concat',
      'difference',
      'differenceBy',
      'differenceWith',
      'intersection',
      'intersectionBy',
      'intersectionWith',
      'pull',
      'pullAll',
      'pullAt',
      'sampleSize',
      'shuffle',
      'slice',
      'splice',
      'split',
      'toArray',
      'union',
      'unionBy',
      'unionWith',
      'uniq',
      'uniqBy',
      'uniqWith',
      'words',
      'xor',
      'xorBy',
      'xorWith'
    ];

    lodashStable.each(funcs, function(methodName) {
      QUnit.test('`_(...).' + methodName + '` should return a new wrapped value', function(assert) {
        assert.expect(2);

        if (!isNpm) {
          var value = methodName == 'split' ? 'abc' : [1, 2, 3],
              wrapped = _(value),
              actual = wrapped[methodName]();

          assert.ok(actual instanceof _);
          assert.notStrictEqual(actual, wrapped);
        }
        else {
          skipAssert(assert, 2);
        }
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash(...) methods that return unwrapped values');

  (function() {
    var funcs = [
      'add',
      'camelCase',
      'capitalize',
      'ceil',
      'clone',
      'deburr',
      'defaultTo',
      'divide',
      'endsWith',
      'escape',
      'escapeRegExp',
      'every',
      'find',
      'floor',
      'has',
      'hasIn',
      'head',
      'includes',
      'isArguments',
      'isArray',
      'isArrayBuffer',
      'isArrayLike',
      'isBoolean',
      'isBuffer',
      'isDate',
      'isElement',
      'isEmpty',
      'isEqual',
      'isError',
      'isFinite',
      'isFunction',
      'isInteger',
      'isMap',
      'isNaN',
      'isNative',
      'isNil',
      'isNull',
      'isNumber',
      'isObject',
      'isObjectLike',
      'isPlainObject',
      'isRegExp',
      'isSafeInteger',
      'isSet',
      'isString',
      'isUndefined',
      'isWeakMap',
      'isWeakSet',
      'join',
      'kebabCase',
      'last',
      'lowerCase',
      'lowerFirst',
      'max',
      'maxBy',
      'min',
      'minBy',
      'multiply',
      'nth',
      'pad',
      'padEnd',
      'padStart',
      'parseInt',
      'pop',
      'random',
      'reduce',
      'reduceRight',
      'repeat',
      'replace',
      'round',
      'sample',
      'shift',
      'size',
      'snakeCase',
      'some',
      'startCase',
      'startsWith',
      'subtract',
      'sum',
      'toFinite',
      'toInteger',
      'toLower',
      'toNumber',
      'toSafeInteger',
      'toString',
      'toUpper',
      'trim',
      'trimEnd',
      'trimStart',
      'truncate',
      'unescape',
      'upperCase',
      'upperFirst'
    ];

    lodashStable.each(funcs, function(methodName) {
      QUnit.test('`_(...).' + methodName + '` should return an unwrapped value when implicitly chaining', function(assert) {
        assert.expect(1);

        if (!isNpm) {
          var actual = _()[methodName]();
          assert.notOk(actual instanceof _);
        }
        else {
          skipAssert(assert);
        }
      });

      QUnit.test('`_(...).' + methodName + '` should return a wrapped value when explicitly chaining', function(assert) {
        assert.expect(1);

        if (!isNpm) {
          var actual = _().chain()[methodName]();
          assert.ok(actual instanceof _);
        }
        else {
          skipAssert(assert);
        }
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('"Arrays" category methods');

  (function() {
    var args = (function() { return arguments; }(1, null, [3], null, 5)),
        sortedArgs = (function() { return arguments; }(1, [3], 5, null, null)),
        array = [1, 2, 3, 4, 5, 6];

    QUnit.test('should work with `arguments` objects', function(assert) {
      assert.expect(30);

      function message(methodName) {
        return '`_.' + methodName + '` should work with `arguments` objects';
      }

      assert.deepEqual(_.difference(args, [null]), [1, [3], 5], message('difference'));
      assert.deepEqual(_.difference(array, args), [2, 3, 4, 6], '_.difference should work with `arguments` objects as secondary arguments');

      assert.deepEqual(_.union(args, [null, 6]), [1, null, [3], 5, 6], message('union'));
      assert.deepEqual(_.union(array, args), array.concat([null, [3]]), '_.union should work with `arguments` objects as secondary arguments');

      assert.deepEqual(_.compact(args), [1, [3], 5], message('compact'));
      assert.deepEqual(_.drop(args, 3), [null, 5], message('drop'));
      assert.deepEqual(_.dropRight(args, 3), [1, null], message('dropRight'));
      assert.deepEqual(_.dropRightWhile(args,identity), [1, null, [3], null], message('dropRightWhile'));
      assert.deepEqual(_.dropWhile(args,identity), [null, [3], null, 5], message('dropWhile'));
      assert.deepEqual(_.findIndex(args, identity), 0, message('findIndex'));
      assert.deepEqual(_.findLastIndex(args, identity), 4, message('findLastIndex'));
      assert.deepEqual(_.flatten(args), [1, null, 3, null, 5], message('flatten'));
      assert.deepEqual(_.head(args), 1, message('head'));
      assert.deepEqual(_.indexOf(args, 5), 4, message('indexOf'));
      assert.deepEqual(_.initial(args), [1, null, [3], null], message('initial'));
      assert.deepEqual(_.intersection(args, [1]), [1], message('intersection'));
      assert.deepEqual(_.last(args), 5, message('last'));
      assert.deepEqual(_.lastIndexOf(args, 1), 0, message('lastIndexOf'));
      assert.deepEqual(_.sortedIndex(sortedArgs, 6), 3, message('sortedIndex'));
      assert.deepEqual(_.sortedIndexOf(sortedArgs, 5), 2, message('sortedIndexOf'));
      assert.deepEqual(_.sortedLastIndex(sortedArgs, 5), 3, message('sortedLastIndex'));
      assert.deepEqual(_.sortedLastIndexOf(sortedArgs, 1), 0, message('sortedLastIndexOf'));
      assert.deepEqual(_.tail(args, 4), [null, [3], null, 5], message('tail'));
      assert.deepEqual(_.take(args, 2), [1, null], message('take'));
      assert.deepEqual(_.takeRight(args, 1), [5], message('takeRight'));
      assert.deepEqual(_.takeRightWhile(args, identity), [5], message('takeRightWhile'));
      assert.deepEqual(_.takeWhile(args, identity), [1], message('takeWhile'));
      assert.deepEqual(_.uniq(args), [1, null, [3], 5], message('uniq'));
      assert.deepEqual(_.without(args, null), [1, [3], 5], message('without'));
      assert.deepEqual(_.zip(args, args), [[1, 1], [null, null], [[3], [3]], [null, null], [5, 5]], message('zip'));
    });

    QUnit.test('should accept falsey primary arguments', function(assert) {
      assert.expect(4);

      function message(methodName) {
        return '`_.' + methodName + '` should accept falsey primary arguments';
      }

      assert.deepEqual(_.difference(null, array), [], message('difference'));
      assert.deepEqual(_.intersection(null, array), [], message('intersection'));
      assert.deepEqual(_.union(null, array), array, message('union'));
      assert.deepEqual(_.xor(null, array), array, message('xor'));
    });

    QUnit.test('should accept falsey secondary arguments', function(assert) {
      assert.expect(3);

      function message(methodName) {
        return '`_.' + methodName + '` should accept falsey secondary arguments';
      }

      assert.deepEqual(_.difference(array, null), array, message('difference'));
      assert.deepEqual(_.intersection(array, null), [], message('intersection'));
      assert.deepEqual(_.union(array, null), array, message('union'));
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('"Strings" category methods');

  (function() {
    var stringMethods = [
      'camelCase',
      'capitalize',
      'escape',
      'kebabCase',
      'lowerCase',
      'lowerFirst',
      'pad',
      'padEnd',
      'padStart',
      'repeat',
      'snakeCase',
      'toLower',
      'toUpper',
      'trim',
      'trimEnd',
      'trimStart',
      'truncate',
      'unescape',
      'upperCase',
      'upperFirst'
    ];

    lodashStable.each(stringMethods, function(methodName) {
      var func = _[methodName];

      QUnit.test('`_.' + methodName + '` should return an empty string for empty values', function(assert) {
        assert.expect(1);

        var values = [, null, undefined, ''],
            expected = lodashStable.map(values, stubString);

        var actual = lodashStable.map(values, function(value, index) {
          return index ? func(value) : func();
        });

        assert.deepEqual(actual, expected);
      });
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.module('lodash methods');

  (function() {
    var allMethods = lodashStable.reject(_.functions(_).sort(), function(methodName) {
      return lodashStable.startsWith(methodName, '_');
    });

    var checkFuncs = [
      'after',
      'ary',
      'before',
      'bind',
      'curry',
      'curryRight',
      'debounce',
      'defer',
      'delay',
      'flip',
      'flow',
      'flowRight',
      'memoize',
      'negate',
      'once',
      'partial',
      'partialRight',
      'rearg',
      'rest',
      'spread',
      'throttle',
      'unary'
    ];

    var noBinding = [
      'flip',
      'memoize',
      'negate',
      'once',
      'overArgs',
      'partial',
      'partialRight',
      'rearg',
      'rest',
      'spread'
    ];

    var rejectFalsey = [
      'tap',
      'thru'
    ].concat(checkFuncs);

    var returnArrays = [
      'at',
      'chunk',
      'compact',
      'difference',
      'drop',
      'filter',
      'flatten',
      'functions',
      'initial',
      'intersection',
      'invokeMap',
      'keys',
      'map',
      'orderBy',
      'pull',
      'pullAll',
      'pullAt',
      'range',
      'rangeRight',
      'reject',
      'remove',
      'shuffle',
      'sortBy',
      'tail',
      'take',
      'times',
      'toArray',
      'toPairs',
      'toPairsIn',
      'union',
      'uniq',
      'values',
      'without',
      'xor',
      'zip'
    ];

    var acceptFalsey = lodashStable.difference(allMethods, rejectFalsey);

    QUnit.test('should accept falsey arguments', function(assert) {
      assert.expect(316);

      var arrays = lodashStable.map(falsey, stubArray);

      lodashStable.each(acceptFalsey, function(methodName) {
        var expected = arrays,
            func = _[methodName],
            pass = true;

        var actual = lodashStable.map(falsey, function(value, index) {
          try {
            return index ? func(value) : func();
          } catch (e) {
            pass = false;
          }
        });

        if (methodName == 'noConflict') {
          root._ = oldDash;
        }
        else if (methodName == 'pull' || methodName == 'pullAll') {
          expected = falsey;
        }
        if (lodashStable.includes(returnArrays, methodName) && methodName != 'sample') {
          assert.deepEqual(actual, expected, '_.' + methodName + ' returns an array');
        }
        assert.ok(pass, '`_.' + methodName + '` accepts falsey arguments');
      });

      // Skip tests for missing methods of modularized builds.
      lodashStable.each(['chain', 'noConflict', 'runInContext'], function(methodName) {
        if (!_[methodName]) {
          skipAssert(assert);
        }
      });
    });

    QUnit.test('should return an array', function(assert) {
      assert.expect(70);

      var array = [1, 2, 3];

      lodashStable.each(returnArrays, function(methodName) {
        var actual,
            func = _[methodName];

        switch (methodName) {
          case 'invokeMap':
            actual = func(array, 'toFixed');
            break;
          case 'sample':
            actual = func(array, 1);
            break;
          default:
            actual = func(array);
        }
        assert.ok(lodashStable.isArray(actual), '_.' + methodName + ' returns an array');

        var isPull = methodName == 'pull' || methodName == 'pullAll';
        assert.strictEqual(actual === array, isPull, '_.' + methodName + ' should ' + (isPull ? '' : 'not ') + 'return the given array');
      });
    });

    QUnit.test('should throw an error for falsey arguments', function(assert) {
      assert.expect(24);

      lodashStable.each(rejectFalsey, function(methodName) {
        var expected = lodashStable.map(falsey, stubTrue),
            func = _[methodName];

        var actual = lodashStable.map(falsey, function(value, index) {
          var pass = !index && /^(?:backflow|compose|cond|flow(Right)?|over(?:Every|Some)?)$/.test(methodName);

          try {
            index ? func(value) : func();
          } catch (e) {
            pass = !pass && (e instanceof TypeError) &&
              (!lodashStable.includes(checkFuncs, methodName) || (e.message == FUNC_ERROR_TEXT));
          }
          return pass;
        });

        assert.deepEqual(actual, expected, '`_.' + methodName + '` rejects falsey arguments');
      });
    });

    QUnit.test('should use `this` binding of function', function(assert) {
      assert.expect(30);

      lodashStable.each(noBinding, function(methodName) {
        var fn = function() { return this.a; },
            func = _[methodName],
            isNegate = methodName == 'negate',
            object = { 'a': 1 },
            expected = isNegate ? false : 1;

        var wrapper = func(_.bind(fn, object));
        assert.strictEqual(wrapper(), expected, '`_.' + methodName + '` can consume a bound function');

        wrapper = _.bind(func(fn), object);
        assert.strictEqual(wrapper(), expected, '`_.' + methodName + '` can be bound');

        object.wrapper = func(fn);
        assert.strictEqual(object.wrapper(), expected, '`_.' + methodName + '` uses the `this` of its parent object');
      });
    });

    QUnit.test('should not contain minified method names (test production builds)', function(assert) {
      assert.expect(1);

      var shortNames = ['_', 'at', 'eq', 'gt', 'lt'];
      assert.ok(lodashStable.every(_.functions(_), function(methodName) {
        return methodName.length > 2 || lodashStable.includes(shortNames, methodName);
      }));
    });
  }());

  /*--------------------------------------------------------------------------*/

  QUnit.config.asyncRetries = 10;
  QUnit.config.hidepassed = true;

  if (!document) {
    QUnit.config.noglobals = true;
    QUnit.load();
    QUnit.start();
  }
}.call(this));
