;(function() {
  'use strict';

  /** Used to access the Firebug Lite panel (set by `run`). */
  var fbPanel;

  /** Used as a safe reference for `undefined` in pre ES5 environments. */
  var undefined;

  /** Used as a reference to the global object. */
  var root = typeof global == 'object' && global || this;

  /** Method and object shortcuts. */
  var phantom = root.phantom,
      amd = root.define && define.amd,
      argv = root.process && process.argv,
      document = !phantom && root.document,
      noop = function() {},
      params = root.arguments,
      system = root.system;

  /** Add `console.log()` support for Rhino and RingoJS. */
  var console = root.console || (root.console = { 'log': root.print });

  /** The file path of the lodash file to test. */
  var filePath = (function() {
    var min = 0,
        result = [];

    if (phantom) {
      result = params = phantom.args;
    } else if (system) {
      min = 1;
      result = params = system.args;
    } else if (argv) {
      min = 2;
      result = params = argv;
    } else if (params) {
      result = params;
    }
    var last = result[result.length - 1];
    result = (result.length > min && !/perf(?:\.js)?$/.test(last)) ? last : '../lodash.js';

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

  /** Used to match path separators. */
  var rePathSeparator = /[\/\\]/;

  /** Used to detect primitive types. */
  var rePrimitive = /^(?:boolean|number|string|undefined)$/;

  /** Used to match RegExp special characters. */
  var reSpecialChars = /[.*+?^=!:${}()|[\]\/\\]/g;

  /** The `ui` object. */
  var ui = root.ui || (root.ui = {
    'buildPath': basename(filePath, '.js'),
    'otherPath': 'underscore'
  });

  /** The lodash build basename. */
  var buildName = root.buildName = basename(ui.buildPath, '.js');

  /** The other library basename. */
  var otherName = root.otherName = (function() {
    var result = basename(ui.otherPath, '.js');
    return result + (result == buildName ? ' (2)' : '');
  }());

  /** Used to score performance. */
  var score = { 'a': [], 'b': [] };

  /** Used to queue benchmark suites. */
  var suites = [];

  /** Use a single "load" function. */
  var load = (typeof require == 'function' && !amd)
    ? require
    : noop;

  /** Load lodash. */
  var lodash = root.lodash || (root.lodash = (
    lodash = load(filePath) || root._,
    lodash = lodash._ || lodash,
    (lodash.runInContext ? lodash.runInContext(root) : lodash),
    lodash.noConflict()
  ));

  /** Load Underscore. */
  var _ = root.underscore || (root.underscore = (
    _ = load('../vendor/underscore/underscore.js') || root._,
    _._ || _
  ));

  /** Load Benchmark.js. */
  var Benchmark = root.Benchmark || (root.Benchmark = (
    Benchmark = load('../node_modules/benchmark/benchmark.js') || root.Benchmark,
    Benchmark = Benchmark.Benchmark || Benchmark,
    Benchmark.runInContext(lodash.extend({}, root, { '_': lodash }))
  ));

  /*--------------------------------------------------------------------------*/

  /**
   * Gets the basename of the given `filePath`. If the file `extension` is passed,
   * it will be removed from the basename.
   *
   * @private
   * @param {string} path The file path to inspect.
   * @param {string} extension The extension to remove.
   * @returns {string} Returns the basename.
   */
  function basename(filePath, extension) {
    var result = (filePath || '').split(rePathSeparator).pop();
    return (arguments.length < 2)
      ? result
      : result.replace(RegExp(extension.replace(reSpecialChars, '\\$&') + '$'), '');
  }

  /**
   * Computes the geometric mean (log-average) of an array of values.
   * See http://en.wikipedia.org/wiki/Geometric_mean#Relationship_with_arithmetic_mean_of_logarithms.
   *
   * @private
   * @param {Array} array The array of values.
   * @returns {number} The geometric mean.
   */
  function getGeometricMean(array) {
    return Math.pow(Math.E, lodash.reduce(array, function(sum, x) {
      return sum + Math.log(x);
    }, 0) / array.length) || 0;
  }

  /**
   * Gets the Hz, i.e. operations per second, of `bench` adjusted for the
   * margin of error.
   *
   * @private
   * @param {Object} bench The benchmark object.
   * @returns {number} Returns the adjusted Hz.
   */
  function getHz(bench) {
    var result = 1 / (bench.stats.mean + bench.stats.moe);
    return isFinite(result) ? result : 0;
  }

  /**
   * Host objects can return type values that are different from their actual
   * data type. The objects we are concerned with usually return non-primitive
   * types of "object", "function", or "unknown".
   *
   * @private
   * @param {*} object The owner of the property.
   * @param {string} property The property to check.
   * @returns {boolean} Returns `true` if the property value is a non-primitive, else `false`.
   */
  function isHostType(object, property) {
    if (object == null) {
      return false;
    }
    var type = typeof object[property];
    return !rePrimitive.test(type) && (type != 'object' || !!object[property]);
  }

  /**
   * Logs text to the console.
   *
   * @private
   * @param {string} text The text to log.
   */
  function log(text) {
    console.log(text + '');
    if (fbPanel) {
      // Scroll the Firebug Lite panel down.
      fbPanel.scrollTop = fbPanel.scrollHeight;
    }
  }

  /**
   * Runs all benchmark suites.
   *
   * @private (@public in the browser)
   */
  function run() {
    fbPanel = (fbPanel = root.document && document.getElementById('FirebugUI')) &&
      (fbPanel = (fbPanel = fbPanel.contentWindow || fbPanel.contentDocument).document || fbPanel) &&
      fbPanel.getElementById('fbPanel1');

    log('\nSit back and relax, this may take a while.');
    suites[0].run({ 'async': true });
  }

  /*--------------------------------------------------------------------------*/

  lodash.extend(Benchmark.Suite.options, {
    'onStart': function() {
      log('\n' + this.name + ':');
    },
    'onCycle': function(event) {
      log(event.target);
    },
    'onComplete': function() {
      for (var index = 0, length = this.length; index < length; index++) {
        var bench = this[index];
        if (bench.error) {
          var errored = true;
        }
      }
      if (errored) {
        log('There was a problem, skipping...');
      }
      else {
        var formatNumber = Benchmark.formatNumber,
            fastest = this.filter('fastest'),
            fastestHz = getHz(fastest[0]),
            slowest = this.filter('slowest'),
            slowestHz = getHz(slowest[0]),
            aHz = getHz(this[0]),
            bHz = getHz(this[1]);

        if (fastest.length > 1) {
          log('It\'s too close to call.');
          aHz = bHz = slowestHz;
        }
        else {
          var percent = ((fastestHz / slowestHz) - 1) * 100;

          log(
            fastest[0].name + ' is ' +
            formatNumber(percent < 1 ? percent.toFixed(2) : Math.round(percent)) +
            '% faster.'
          );
        }
        // Add score adjusted for margin of error.
        score.a.push(aHz);
        score.b.push(bHz);
      }
      // Remove current suite from queue.
      suites.shift();

      if (suites.length) {
        // Run next suite.
        suites[0].run({ 'async': true });
      }
      else {
        var aMeanHz = getGeometricMean(score.a),
            bMeanHz = getGeometricMean(score.b),
            fastestMeanHz = Math.max(aMeanHz, bMeanHz),
            slowestMeanHz = Math.min(aMeanHz, bMeanHz),
            xFaster = fastestMeanHz / slowestMeanHz,
            percentFaster = formatNumber(Math.round((xFaster - 1) * 100)),
            message = 'is ' + percentFaster + '% ' + (xFaster == 1 ? '' : '(' + formatNumber(xFaster.toFixed(2)) + 'x) ') + 'faster than';

        // Report results.
        if (aMeanHz >= bMeanHz) {
          log('\n' + buildName + ' ' + message + ' ' + otherName + '.');
        } else {
          log('\n' + otherName + ' ' + message + ' ' + buildName + '.');
        }
      }
    }
  });

  /*--------------------------------------------------------------------------*/

  lodash.extend(Benchmark.options, {
    'async': true,
    'setup': '\
      var _ = global.underscore,\
          lodash = global.lodash,\
          belt = this.name == buildName ? lodash : _;\
      \
      var date = new Date,\
          limit = 50,\
          regexp = /x/,\
          object = {},\
          objects = Array(limit),\
          numbers = Array(limit),\
          fourNumbers = [5, 25, 10, 30],\
          nestedNumbers = [1, [2], [3, [[4]]]],\
          nestedObjects = [{}, [{}], [{}, [[{}]]]],\
          twoNumbers = [12, 23];\
      \
      for (var index = 0; index < limit; index++) {\
        numbers[index] = index;\
        object["key" + index] = index;\
        objects[index] = { "num": index };\
      }\
      var strNumbers = numbers + "";\
      \
      if (typeof assign != "undefined") {\
        var _assign = _.assign || _.extend,\
            lodashAssign = lodash.assign;\
      }\
      if (typeof bind != "undefined") {\
        var thisArg = { "name": "fred" };\
        \
        var func = function(greeting, punctuation) {\
          return (greeting || "hi") + " " + this.name + (punctuation || ".");\
        };\
        \
        var _boundNormal = _.bind(func, thisArg),\
            _boundMultiple = _boundNormal,\
            _boundPartial = _.bind(func, thisArg, "hi");\
        \
        var lodashBoundNormal = lodash.bind(func, thisArg),\
            lodashBoundMultiple = lodashBoundNormal,\
            lodashBoundPartial = lodash.bind(func, thisArg, "hi");\
        \
        for (index = 0; index < 10; index++) {\
          _boundMultiple = _.bind(_boundMultiple, { "name": "fred" + index });\
          lodashBoundMultiple = lodash.bind(lodashBoundMultiple, { "name": "fred" + index });\
        }\
      }\
      if (typeof bindAll != "undefined") {\
        var bindAllCount = -1,\
            bindAllObjects = Array(this.count);\
        \
        var funcNames = belt.reject(belt.functions(belt).slice(0, 40), function(funcName) {\
          return /^_/.test(funcName);\
        });\
        \
        // Potentially expensive.\n\
        for (index = 0; index < this.count; index++) {\
          bindAllObjects[index] = belt.reduce(funcNames, function(object, funcName) {\
            object[funcName] = belt[funcName];\
            return object;\
          }, {});\
        }\
      }\
      if (typeof chaining != "undefined") {\
        var even = function(v) { return v % 2 == 0; },\
            square = function(v) { return v * v; };\
        \
        var largeArray = belt.range(10000),\
            _chaining = _(largeArray).chain(),\
            lodashChaining = lodash(largeArray).chain();\
      }\
      if (typeof compact != "undefined") {\
        var uncompacted = numbers.slice();\
        uncompacted[2] = false;\
        uncompacted[6] = null;\
        uncompacted[18] = "";\
      }\
      if (typeof flowRight != "undefined") {\
        var compAddOne = function(n) { return n + 1; },\
            compAddTwo = function(n) { return n + 2; },\
            compAddThree = function(n) { return n + 3; };\
        \
        var _composed = _.flowRight && _.flowRight(compAddThree, compAddTwo, compAddOne),\
            lodashComposed = lodash.flowRight && lodash.flowRight(compAddThree, compAddTwo, compAddOne);\
      }\
      if (typeof countBy != "undefined" || typeof omit != "undefined") {\
        var wordToNumber = {\
          "one": 1,\
          "two": 2,\
          "three": 3,\
          "four": 4,\
          "five": 5,\
          "six": 6,\
          "seven": 7,\
          "eight": 8,\
          "nine": 9,\
          "ten": 10,\
          "eleven": 11,\
          "twelve": 12,\
          "thirteen": 13,\
          "fourteen": 14,\
          "fifteen": 15,\
          "sixteen": 16,\
          "seventeen": 17,\
          "eighteen": 18,\
          "nineteen": 19,\
          "twenty": 20,\
          "twenty-one": 21,\
          "twenty-two": 22,\
          "twenty-three": 23,\
          "twenty-four": 24,\
          "twenty-five": 25,\
          "twenty-six": 26,\
          "twenty-seven": 27,\
          "twenty-eight": 28,\
          "twenty-nine": 29,\
          "thirty": 30,\
          "thirty-one": 31,\
          "thirty-two": 32,\
          "thirty-three": 33,\
          "thirty-four": 34,\
          "thirty-five": 35,\
          "thirty-six": 36,\
          "thirty-seven": 37,\
          "thirty-eight": 38,\
          "thirty-nine": 39,\
          "forty": 40\
        };\
        \
        var words = belt.keys(wordToNumber).slice(0, limit);\
      }\
      if (typeof flatten != "undefined") {\
        var _flattenDeep = _.flatten([[1]])[0] !== 1,\
            lodashFlattenDeep = lodash.flatten([[1]])[0] !== 1;\
      }\
      if (typeof isEqual != "undefined") {\
        var objectOfPrimitives = {\
          "boolean": true,\
          "number": 1,\
          "string": "a"\
        };\
        \
        var objectOfObjects = {\
          "boolean": new Boolean(true),\
          "number": new Number(1),\
          "string": new String("a")\
        };\
        \
        var objectOfObjects2 = {\
          "boolean": new Boolean(true),\
          "number": new Number(1),\
          "string": new String("A")\
        };\
        \
        var object2 = {},\
            object3 = {},\
            objects2 = Array(limit),\
            objects3 = Array(limit),\
            numbers2 = Array(limit),\
            numbers3 = Array(limit),\
            nestedNumbers2 = [1, [2], [3, [[4]]]],\
            nestedNumbers3 = [1, [2], [3, [[6]]]];\
        \
        for (index = 0; index < limit; index++) {\
          object2["key" + index] = index;\
          object3["key" + index] = index;\
          objects2[index] = { "num": index };\
          objects3[index] = { "num": index };\
          numbers2[index] = index;\
          numbers3[index] = index;\
        }\
        object3["key" + (limit - 1)] = -1;\
        objects3[limit - 1].num = -1;\
        numbers3[limit - 1] = -1;\
      }\
      if (typeof matches != "undefined") {\
        var source = { "num": 9 };\
        \
        var _matcher = (_.matches || _.noop)(source),\
            lodashMatcher = (lodash.matches || lodash.noop)(source);\
      }\
      if (typeof multiArrays != "undefined") {\
        var twentyValues = belt.shuffle(belt.range(20)),\
            fortyValues = belt.shuffle(belt.range(40)),\
            hundredSortedValues = belt.range(100),\
            hundredValues = belt.shuffle(hundredSortedValues),\
            hundredValues2 = belt.shuffle(hundredValues),\
            hundredTwentyValues = belt.shuffle(belt.range(120)),\
            hundredTwentyValues2 = belt.shuffle(hundredTwentyValues),\
            twoHundredValues = belt.shuffle(belt.range(200)),\
            twoHundredValues2 = belt.shuffle(twoHundredValues);\
      }\
      if (typeof partial != "undefined") {\
        var func = function(greeting, punctuation) {\
          return greeting + " fred" + (punctuation || ".");\
        };\
        \
        var _partial = _.partial(func, "hi"),\
            lodashPartial = lodash.partial(func, "hi");\
      }\
      if (typeof template != "undefined") {\
        var tplData = {\
          "header1": "Header1",\
          "header2": "Header2",\
          "header3": "Header3",\
          "header4": "Header4",\
          "header5": "Header5",\
          "header6": "Header6",\
          "list": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]\
        };\
        \
        var tpl =\
          "<div>" +\
          "<h1 class=\'header1\'><%= header1 %></h1>" +\
          "<h2 class=\'header2\'><%= header2 %></h2>" +\
          "<h3 class=\'header3\'><%= header3 %></h3>" +\
          "<h4 class=\'header4\'><%= header4 %></h4>" +\
          "<h5 class=\'header5\'><%= header5 %></h5>" +\
          "<h6 class=\'header6\'><%= header6 %></h6>" +\
          "<ul class=\'list\'>" +\
          "<% for (var index = 0, length = list.length; index < length; index++) { %>" +\
          "<li class=\'item\'><%= list[index] %></li>" +\
          "<% } %>" +\
          "</ul>" +\
          "</div>";\
        \
        var tplVerbose =\
          "<div>" +\
          "<h1 class=\'header1\'><%= data.header1 %></h1>" +\
          "<h2 class=\'header2\'><%= data.header2 %></h2>" +\
          "<h3 class=\'header3\'><%= data.header3 %></h3>" +\
          "<h4 class=\'header4\'><%= data.header4 %></h4>" +\
          "<h5 class=\'header5\'><%= data.header5 %></h5>" +\
          "<h6 class=\'header6\'><%= data.header6 %></h6>" +\
          "<ul class=\'list\'>" +\
          "<% for (var index = 0, length = data.list.length; index < length; index++) { %>" +\
          "<li class=\'item\'><%= data.list[index] %></li>" +\
          "<% } %>" +\
          "</ul>" +\
          "</div>";\
        \
        var settingsObject = { "variable": "data" };\
        \
        var _tpl = _.template(tpl),\
            _tplVerbose = _.template(tplVerbose, null, settingsObject);\
        \
        var lodashTpl = lodash.template(tpl),\
            lodashTplVerbose = lodash.template(tplVerbose, null, settingsObject);\
      }\
      if (typeof wrap != "undefined") {\
        var add = function(a, b) {\
          return a + b;\
        };\
        \
        var average = function(func, a, b) {\
          return (func(a, b) / 2).toFixed(2);\
        };\
        \
        var _wrapped = _.wrap(add, average);\
            lodashWrapped = lodash.wrap(add, average);\
      }\
      if (typeof zip != "undefined") {\
        var unzipped = [["a", "b", "c"], [1, 2, 3], [true, false, true]];\
      }'
  });

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_(...).map(...).filter(...).take(...).value()`')
      .add(buildName, {
        'fn': 'lodashChaining.map(square).filter(even).take(100).value()',
        'teardown': 'function chaining(){}'
      })
      .add(otherName, {
        'fn': '_chaining.map(square).filter(even).take(100).value()',
        'teardown': 'function chaining(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.assign`')
      .add(buildName, {
        'fn': 'lodashAssign({}, { "a": 1, "b": 2, "c": 3 })',
        'teardown': 'function assign(){}'
      })
      .add(otherName, {
        'fn': '_assign({}, { "a": 1, "b": 2, "c": 3 })',
        'teardown': 'function assign(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.assign` with multiple sources')
      .add(buildName, {
        'fn': 'lodashAssign({}, { "a": 1, "b": 2 }, { "c": 3, "d": 4 })',
        'teardown': 'function assign(){}'
      })
      .add(otherName, {
        'fn': '_assign({}, { "a": 1, "b": 2 }, { "c": 3, "d": 4 })',
        'teardown': 'function assign(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.bind` (slow path)')
      .add(buildName, {
        'fn': 'lodash.bind(function() { return this.name; }, { "name": "fred" })',
        'teardown': 'function bind(){}'
      })
      .add(otherName, {
        'fn': '_.bind(function() { return this.name; }, { "name": "fred" })',
        'teardown': 'function bind(){}'
      })
  );

  suites.push(
    Benchmark.Suite('bound call with arguments')
      .add(buildName, {
        'fn': 'lodashBoundNormal("hi", "!")',
        'teardown': 'function bind(){}'
      })
      .add(otherName, {
        'fn': '_boundNormal("hi", "!")',
        'teardown': 'function bind(){}'
      })
  );

  suites.push(
    Benchmark.Suite('bound and partially applied call with arguments')
      .add(buildName, {
        'fn': 'lodashBoundPartial("!")',
        'teardown': 'function bind(){}'
      })
      .add(otherName, {
        'fn': '_boundPartial("!")',
        'teardown': 'function bind(){}'
      })
  );

  suites.push(
    Benchmark.Suite('bound multiple times')
      .add(buildName, {
        'fn': 'lodashBoundMultiple()',
        'teardown': 'function bind(){}'
      })
      .add(otherName, {
        'fn': '_boundMultiple()',
        'teardown': 'function bind(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.bindAll`')
      .add(buildName, {
        'fn': 'lodash.bindAll(bindAllObjects[++bindAllCount], funcNames)',
        'teardown': 'function bindAll(){}'
      })
      .add(otherName, {
        'fn': '_.bindAll(bindAllObjects[++bindAllCount], funcNames)',
        'teardown': 'function bindAll(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.clone` with an array')
      .add(buildName, '\
        lodash.clone(numbers)'
      )
      .add(otherName, '\
        _.clone(numbers)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.clone` with an object')
      .add(buildName, '\
        lodash.clone(object)'
      )
      .add(otherName, '\
        _.clone(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.compact`')
      .add(buildName, {
        'fn': 'lodash.compact(uncompacted)',
        'teardown': 'function compact(){}'
      })
      .add(otherName, {
        'fn': '_.compact(uncompacted)',
        'teardown': 'function compact(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.countBy` with `callback` iterating an array')
      .add(buildName, '\
        lodash.countBy(numbers, function(num) { return num >> 1; })'
      )
      .add(otherName, '\
        _.countBy(numbers, function(num) { return num >> 1; })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.countBy` with `property` name iterating an array')
      .add(buildName, {
        'fn': 'lodash.countBy(words, "length")',
        'teardown': 'function countBy(){}'
      })
      .add(otherName, {
        'fn': '_.countBy(words, "length")',
        'teardown': 'function countBy(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.countBy` with `callback` iterating an object')
      .add(buildName, {
        'fn': 'lodash.countBy(wordToNumber, function(num) { return num >> 1; })',
        'teardown': 'function countBy(){}'
      })
      .add(otherName, {
        'fn': '_.countBy(wordToNumber, function(num) { return num >> 1; })',
        'teardown': 'function countBy(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.defaults`')
      .add(buildName, '\
        lodash.defaults({ "key2": 2, "key6": 6, "key18": 18 }, object)'
      )
      .add(otherName, '\
        _.defaults({ "key2": 2, "key6": 6, "key18": 18 }, object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.difference`')
      .add(buildName, '\
        lodash.difference(numbers, twoNumbers, fourNumbers)'
      )
      .add(otherName, '\
        _.difference(numbers, twoNumbers, fourNumbers)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.difference` iterating 20 and 40 elements')
      .add(buildName, {
        'fn': 'lodash.difference(twentyValues, fortyValues)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.difference(twentyValues, fortyValues)',
        'teardown': 'function multiArrays(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.difference` iterating 200 elements')
      .add(buildName, {
        'fn': 'lodash.difference(twoHundredValues, twoHundredValues2)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.difference(twoHundredValues, twoHundredValues2)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.each` iterating an array')
      .add(buildName, '\
        var result = [];\
        lodash.each(numbers, function(num) {\
          result.push(num * 2);\
        })'
      )
      .add(otherName, '\
        var result = [];\
        _.each(numbers, function(num) {\
          result.push(num * 2);\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.each` iterating an object')
      .add(buildName, '\
        var result = [];\
        lodash.each(object, function(num) {\
          result.push(num * 2);\
        })'
      )
      .add(otherName, '\
        var result = [];\
        _.each(object, function(num) {\
          result.push(num * 2);\
        })'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.every` iterating an array')
      .add(buildName, '\
        lodash.every(numbers, function(num) {\
          return num < limit;\
        })'
      )
      .add(otherName, '\
        _.every(numbers, function(num) {\
          return num < limit;\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.every` iterating an object')
      .add(buildName, '\
        lodash.every(object, function(num) {\
          return num < limit;\
        })'
      )
      .add(otherName, '\
        _.every(object, function(num) {\
          return num < limit;\
        })'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.filter` iterating an array')
      .add(buildName, '\
        lodash.filter(numbers, function(num) {\
          return num % 2;\
        })'
      )
      .add(otherName, '\
        _.filter(numbers, function(num) {\
          return num % 2;\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.filter` iterating an object')
      .add(buildName, '\
        lodash.filter(object, function(num) {\
          return num % 2\
        })'
      )
      .add(otherName, '\
        _.filter(object, function(num) {\
          return num % 2\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.filter` with `_.matches` shorthand')
      .add(buildName, {
        'fn': 'lodash.filter(objects, source)',
        'teardown': 'function matches(){}'
      })
      .add(otherName, {
        'fn': '_.filter(objects, source)',
        'teardown': 'function matches(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.filter` with `_.matches` predicate')
      .add(buildName, {
        'fn': 'lodash.filter(objects, lodashMatcher)',
        'teardown': 'function matches(){}'
      })
      .add(otherName, {
        'fn': '_.filter(objects, _matcher)',
        'teardown': 'function matches(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.find` iterating an array')
      .add(buildName, '\
        lodash.find(numbers, function(num) {\
          return num === (limit - 1);\
        })'
      )
      .add(otherName, '\
        _.find(numbers, function(num) {\
          return num === (limit - 1);\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.find` iterating an object')
      .add(buildName, '\
        lodash.find(object, function(value, key) {\
          return /\D9$/.test(key);\
        })'
      )
      .add(otherName, '\
        _.find(object, function(value, key) {\
          return /\D9$/.test(key);\
        })'
      )
  );

  // Avoid Underscore induced `OutOfMemoryError` in Rhino and Ringo.
  suites.push(
    Benchmark.Suite('`_.find` with `_.matches` shorthand')
      .add(buildName, {
        'fn': 'lodash.find(objects, source)',
        'teardown': 'function matches(){}'
      })
      .add(otherName, {
        'fn': '_.find(objects, source)',
        'teardown': 'function matches(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.flatten`')
      .add(buildName, {
        'fn': 'lodash.flatten(nestedNumbers, !lodashFlattenDeep)',
        'teardown': 'function flatten(){}'
      })
      .add(otherName, {
        'fn': '_.flatten(nestedNumbers, !_flattenDeep)',
        'teardown': 'function flatten(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.flattenDeep` nested arrays of numbers')
      .add(buildName, {
        'fn': 'lodash.flattenDeep(nestedNumbers)',
        'teardown': 'function flatten(){}'
      })
      .add(otherName, {
        'fn': '_.flattenDeep(nestedNumbers)',
        'teardown': 'function flatten(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.flattenDeep` nest arrays of objects')
      .add(buildName, {
        'fn': 'lodash.flattenDeep(nestedObjects)',
        'teardown': 'function flatten(){}'
      })
      .add(otherName, {
        'fn': '_.flattenDeep(nestedObjects)',
        'teardown': 'function flatten(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.flowRight`')
      .add(buildName, {
        'fn': 'lodash.flowRight(compAddThree, compAddTwo, compAddOne)',
        'teardown': 'function flowRight(){}'
      })
      .add(otherName, {
        'fn': '_.flowRight(compAddThree, compAddTwo, compAddOne)',
        'teardown': 'function flowRight(){}'
      })
  );

  suites.push(
    Benchmark.Suite('composed call')
      .add(buildName, {
        'fn': 'lodashComposed(0)',
        'teardown': 'function flowRight(){}'
      })
      .add(otherName, {
        'fn': '_composed(0)',
        'teardown': 'function flowRight(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.functions`')
      .add(buildName, '\
        lodash.functions(lodash)'
      )
      .add(otherName, '\
        _.functions(lodash)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.groupBy` with `callback` iterating an array')
      .add(buildName, '\
        lodash.groupBy(numbers, function(num) { return num >> 1; })'
      )
      .add(otherName, '\
        _.groupBy(numbers, function(num) { return num >> 1; })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.groupBy` with `property` name iterating an array')
      .add(buildName, {
        'fn': 'lodash.groupBy(words, "length")',
        'teardown': 'function countBy(){}'
      })
      .add(otherName, {
        'fn': '_.groupBy(words, "length")',
        'teardown': 'function countBy(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.groupBy` with `callback` iterating an object')
      .add(buildName, {
        'fn': 'lodash.groupBy(wordToNumber, function(num) { return num >> 1; })',
        'teardown': 'function countBy(){}'
      })
      .add(otherName, {
        'fn': '_.groupBy(wordToNumber, function(num) { return num >> 1; })',
        'teardown': 'function countBy(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.includes` searching an array')
      .add(buildName, '\
        lodash.includes(numbers, limit - 1)'
      )
      .add(otherName, '\
        _.includes(numbers, limit - 1)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.includes` searching an object')
      .add(buildName, '\
        lodash.includes(object, limit - 1)'
      )
      .add(otherName, '\
        _.includes(object, limit - 1)'
      )
  );

  if (lodash.includes('ab', 'ab') && _.includes('ab', 'ab')) {
    suites.push(
      Benchmark.Suite('`_.includes` searching a string')
        .add(buildName, '\
          lodash.includes(strNumbers, "," + (limit - 1))'
        )
        .add(otherName, '\
          _.includes(strNumbers, "," + (limit - 1))'
        )
    );
  }

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.indexOf`')
      .add(buildName, {
        'fn': 'lodash.indexOf(hundredSortedValues, 99)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.indexOf(hundredSortedValues, 99)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.intersection`')
      .add(buildName, '\
        lodash.intersection(numbers, twoNumbers, fourNumbers)'
      )
      .add(otherName, '\
        _.intersection(numbers, twoNumbers, fourNumbers)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.intersection` iterating 120 elements')
      .add(buildName, {
        'fn': 'lodash.intersection(hundredTwentyValues, hundredTwentyValues2)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.intersection(hundredTwentyValues, hundredTwentyValues2)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.invert`')
      .add(buildName, '\
        lodash.invert(object)'
      )
      .add(otherName, '\
        _.invert(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.invokeMap` iterating an array')
      .add(buildName, '\
        lodash.invokeMap(numbers, "toFixed")'
      )
      .add(otherName, '\
        _.invokeMap(numbers, "toFixed")'
      )
  );

  suites.push(
    Benchmark.Suite('`_.invokeMap` with arguments iterating an array')
      .add(buildName, '\
        lodash.invokeMap(numbers, "toFixed", 1)'
      )
      .add(otherName, '\
        _.invokeMap(numbers, "toFixed", 1)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.invokeMap` with a function for `path` iterating an array')
      .add(buildName, '\
        lodash.invokeMap(numbers, Number.prototype.toFixed, 1)'
      )
      .add(otherName, '\
        _.invokeMap(numbers, Number.prototype.toFixed, 1)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.invokeMap` iterating an object')
      .add(buildName, '\
        lodash.invokeMap(object, "toFixed", 1)'
      )
      .add(otherName, '\
        _.invokeMap(object, "toFixed", 1)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.isEqual` comparing primitives')
      .add(buildName, {
        'fn': '\
          lodash.isEqual(1, "1");\
          lodash.isEqual(1, 1)',
        'teardown': 'function isEqual(){}'
      })
      .add(otherName, {
        'fn': '\
          _.isEqual(1, "1");\
          _.isEqual(1, 1);',
        'teardown': 'function isEqual(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.isEqual` comparing primitives and their object counterparts (edge case)')
      .add(buildName, {
        'fn': '\
          lodash.isEqual(objectOfPrimitives, objectOfObjects);\
          lodash.isEqual(objectOfPrimitives, objectOfObjects2)',
        'teardown': 'function isEqual(){}'
      })
      .add(otherName, {
        'fn': '\
          _.isEqual(objectOfPrimitives, objectOfObjects);\
          _.isEqual(objectOfPrimitives, objectOfObjects2)',
        'teardown': 'function isEqual(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.isEqual` comparing arrays')
      .add(buildName, {
        'fn': '\
          lodash.isEqual(numbers, numbers2);\
          lodash.isEqual(numbers2, numbers3)',
        'teardown': 'function isEqual(){}'
      })
      .add(otherName, {
        'fn': '\
          _.isEqual(numbers, numbers2);\
          _.isEqual(numbers2, numbers3)',
        'teardown': 'function isEqual(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.isEqual` comparing nested arrays')
      .add(buildName, {
        'fn': '\
          lodash.isEqual(nestedNumbers, nestedNumbers2);\
          lodash.isEqual(nestedNumbers2, nestedNumbers3)',
        'teardown': 'function isEqual(){}'
      })
      .add(otherName, {
        'fn': '\
          _.isEqual(nestedNumbers, nestedNumbers2);\
          _.isEqual(nestedNumbers2, nestedNumbers3)',
        'teardown': 'function isEqual(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.isEqual` comparing arrays of objects')
      .add(buildName, {
        'fn': '\
          lodash.isEqual(objects, objects2);\
          lodash.isEqual(objects2, objects3)',
        'teardown': 'function isEqual(){}'
      })
      .add(otherName, {
        'fn': '\
          _.isEqual(objects, objects2);\
          _.isEqual(objects2, objects3)',
        'teardown': 'function isEqual(){}'
      })
  );

  suites.push(
    Benchmark.Suite('`_.isEqual` comparing objects')
      .add(buildName, {
        'fn': '\
          lodash.isEqual(object, object2);\
          lodash.isEqual(object2, object3)',
        'teardown': 'function isEqual(){}'
      })
      .add(otherName, {
        'fn': '\
          _.isEqual(object, object2);\
          _.isEqual(object2, object3)',
        'teardown': 'function isEqual(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.isArguments`, `_.isDate`, `_.isFunction`, `_.isNumber`, `_.isObject`, `_.isRegExp`')
      .add(buildName, '\
        lodash.isArguments(arguments);\
        lodash.isArguments(object);\
        lodash.isDate(date);\
        lodash.isDate(object);\
        lodash.isFunction(lodash);\
        lodash.isFunction(object);\
        lodash.isNumber(1);\
        lodash.isNumber(object);\
        lodash.isObject(object);\
        lodash.isObject(1);\
        lodash.isRegExp(regexp);\
        lodash.isRegExp(object)'
      )
      .add(otherName, '\
        _.isArguments(arguments);\
        _.isArguments(object);\
        _.isDate(date);\
        _.isDate(object);\
        _.isFunction(_);\
        _.isFunction(object);\
        _.isNumber(1);\
        _.isNumber(object);\
        _.isObject(object);\
        _.isObject(1);\
        _.isRegExp(regexp);\
        _.isRegExp(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.keys` (uses native `Object.keys` if available)')
      .add(buildName, '\
        lodash.keys(object)'
      )
      .add(otherName, '\
        _.keys(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.lastIndexOf`')
      .add(buildName, {
        'fn': 'lodash.lastIndexOf(hundredSortedValues, 0)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.lastIndexOf(hundredSortedValues, 0)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.map` iterating an array')
      .add(buildName, '\
        lodash.map(objects, function(value) {\
          return value.num;\
        })'
      )
      .add(otherName, '\
        _.map(objects, function(value) {\
          return value.num;\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.map` iterating an object')
      .add(buildName, '\
        lodash.map(object, function(value) {\
          return value;\
        })'
      )
      .add(otherName, '\
        _.map(object, function(value) {\
          return value;\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.map` with `_.property` shorthand')
      .add(buildName, '\
        lodash.map(objects, "num")'
      )
      .add(otherName, '\
        _.map(objects, "num")'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.max`')
      .add(buildName, '\
        lodash.max(numbers)'
      )
      .add(otherName, '\
        _.max(numbers)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.min`')
      .add(buildName, '\
        lodash.min(numbers)'
      )
      .add(otherName, '\
        _.min(numbers)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.omit` iterating 20 properties, omitting 2 keys')
      .add(buildName, '\
        lodash.omit(object, "key6", "key13")'
      )
      .add(otherName, '\
        _.omit(object, "key6", "key13")'
      )
  );

  suites.push(
    Benchmark.Suite('`_.omit` iterating 40 properties, omitting 20 keys')
      .add(buildName, {
        'fn': 'lodash.omit(wordToNumber, words)',
        'teardown': 'function omit(){}'
      })
      .add(otherName, {
        'fn': '_.omit(wordToNumber, words)',
        'teardown': 'function omit(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.partial` (slow path)')
      .add(buildName, {
        'fn': 'lodash.partial(function(greeting) { return greeting + " " + this.name; }, "hi")',
        'teardown': 'function partial(){}'
      })
      .add(otherName, {
        'fn': '_.partial(function(greeting) { return greeting + " " + this.name; }, "hi")',
        'teardown': 'function partial(){}'
      })
  );

  suites.push(
    Benchmark.Suite('partially applied call with arguments')
      .add(buildName, {
        'fn': 'lodashPartial("!")',
        'teardown': 'function partial(){}'
      })
      .add(otherName, {
        'fn': '_partial("!")',
        'teardown': 'function partial(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.partition` iterating an array')
      .add(buildName, '\
        lodash.partition(numbers, function(num) {\
          return num % 2;\
        })'
      )
      .add(otherName, '\
        _.partition(numbers, function(num) {\
          return num % 2;\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.partition` iterating an object')
      .add(buildName, '\
        lodash.partition(object, function(num) {\
          return num % 2;\
        })'
      )
      .add(otherName, '\
        _.partition(object, function(num) {\
          return num % 2;\
        })'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.pick`')
      .add(buildName, '\
        lodash.pick(object, "key6", "key13")'
      )
      .add(otherName, '\
        _.pick(object, "key6", "key13")'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.reduce` iterating an array')
      .add(buildName, '\
        lodash.reduce(numbers, function(result, value, index) {\
          result[index] = value;\
          return result;\
        }, {})'
      )
      .add(otherName, '\
        _.reduce(numbers, function(result, value, index) {\
          result[index] = value;\
          return result;\
        }, {})'
      )
  );

  suites.push(
    Benchmark.Suite('`_.reduce` iterating an object')
      .add(buildName, '\
        lodash.reduce(object, function(result, value, key) {\
          result.push(key, value);\
          return result;\
        }, [])'
      )
      .add(otherName, '\
        _.reduce(object, function(result, value, key) {\
          result.push(key, value);\
          return result;\
        }, [])'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.reduceRight` iterating an array')
      .add(buildName, '\
        lodash.reduceRight(numbers, function(result, value, index) {\
          result[index] = value;\
          return result;\
        }, {})'
      )
      .add(otherName, '\
        _.reduceRight(numbers, function(result, value, index) {\
          result[index] = value;\
          return result;\
        }, {})'
      )
  );

  suites.push(
    Benchmark.Suite('`_.reduceRight` iterating an object')
      .add(buildName, '\
        lodash.reduceRight(object, function(result, value, key) {\
          result.push(key, value);\
          return result;\
        }, [])'
      )
      .add(otherName, '\
        _.reduceRight(object, function(result, value, key) {\
          result.push(key, value);\
          return result;\
        }, [])'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.reject` iterating an array')
      .add(buildName, '\
        lodash.reject(numbers, function(num) {\
          return num % 2;\
        })'
      )
      .add(otherName, '\
        _.reject(numbers, function(num) {\
          return num % 2;\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.reject` iterating an object')
      .add(buildName, '\
        lodash.reject(object, function(num) {\
          return num % 2;\
        })'
      )
      .add(otherName, '\
        _.reject(object, function(num) {\
          return num % 2;\
        })'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.sampleSize`')
      .add(buildName, '\
        lodash.sampleSize(numbers, limit / 2)'
      )
      .add(otherName, '\
        _.sampleSize(numbers, limit / 2)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.shuffle`')
      .add(buildName, '\
        lodash.shuffle(numbers)'
      )
      .add(otherName, '\
        _.shuffle(numbers)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.size` with an object')
      .add(buildName, '\
        lodash.size(object)'
      )
      .add(otherName, '\
        _.size(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.some` iterating an array')
      .add(buildName, '\
        lodash.some(numbers, function(num) {\
          return num == (limit - 1);\
        })'
      )
      .add(otherName, '\
        _.some(numbers, function(num) {\
          return num == (limit - 1);\
        })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.some` iterating an object')
      .add(buildName, '\
        lodash.some(object, function(num) {\
          return num == (limit - 1);\
        })'
      )
      .add(otherName, '\
        _.some(object, function(num) {\
          return num == (limit - 1);\
        })'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.sortBy` with `callback`')
      .add(buildName, '\
        lodash.sortBy(numbers, function(num) { return Math.sin(num); })'
      )
      .add(otherName, '\
        _.sortBy(numbers, function(num) { return Math.sin(num); })'
      )
  );

  suites.push(
    Benchmark.Suite('`_.sortBy` with `property` name')
      .add(buildName, {
        'fn': 'lodash.sortBy(words, "length")',
        'teardown': 'function countBy(){}'
      })
      .add(otherName, {
        'fn': '_.sortBy(words, "length")',
        'teardown': 'function countBy(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.sortedIndex`')
      .add(buildName, '\
        lodash.sortedIndex(numbers, limit)'
      )
      .add(otherName, '\
        _.sortedIndex(numbers, limit)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.sortedIndexBy`')
      .add(buildName, {
        'fn': '\
          lodash.sortedIndexBy(words, "twenty-five", function(value) {\
            return wordToNumber[value];\
          })',
        'teardown': 'function countBy(){}'
      })
      .add(otherName, {
        'fn': '\
          _.sortedIndexBy(words, "twenty-five", function(value) {\
            return wordToNumber[value];\
          })',
        'teardown': 'function countBy(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.sortedIndexOf`')
      .add(buildName, {
        'fn': 'lodash.sortedIndexOf(hundredSortedValues, 99)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.sortedIndexOf(hundredSortedValues, 99)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.sortedLastIndexOf`')
      .add(buildName, {
        'fn': 'lodash.sortedLastIndexOf(hundredSortedValues, 0)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.sortedLastIndexOf(hundredSortedValues, 0)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.sum`')
      .add(buildName, '\
        lodash.sum(numbers)'
      )
      .add(otherName, '\
        _.sum(numbers)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.template` (slow path)')
      .add(buildName, {
        'fn': 'lodash.template(tpl)(tplData)',
        'teardown': 'function template(){}'
      })
      .add(otherName, {
        'fn': '_.template(tpl)(tplData)',
        'teardown': 'function template(){}'
      })
  );

  suites.push(
    Benchmark.Suite('compiled template')
      .add(buildName, {
        'fn': 'lodashTpl(tplData)',
        'teardown': 'function template(){}'
      })
      .add(otherName, {
        'fn': '_tpl(tplData)',
        'teardown': 'function template(){}'
      })
  );

  suites.push(
    Benchmark.Suite('compiled template without a with-statement')
      .add(buildName, {
        'fn': 'lodashTplVerbose(tplData)',
        'teardown': 'function template(){}'
      })
      .add(otherName, {
        'fn': '_tplVerbose(tplData)',
        'teardown': 'function template(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.times`')
      .add(buildName, '\
        var result = [];\
        lodash.times(limit, function(n) { result.push(n); })'
      )
      .add(otherName, '\
        var result = [];\
        _.times(limit, function(n) { result.push(n); })'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.toArray` with an array (edge case)')
      .add(buildName, '\
        lodash.toArray(numbers)'
      )
      .add(otherName, '\
        _.toArray(numbers)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.toArray` with an object')
      .add(buildName, '\
        lodash.toArray(object)'
      )
      .add(otherName, '\
        _.toArray(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.toPairs`')
      .add(buildName, '\
        lodash.toPairs(object)'
      )
      .add(otherName, '\
        _.toPairs(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.unescape` string without html entities')
      .add(buildName, '\
        lodash.unescape("`&`, `<`, `>`, `\\"`, and `\'`")'
      )
      .add(otherName, '\
        _.unescape("`&`, `<`, `>`, `\\"`, and `\'`")'
      )
  );

  suites.push(
    Benchmark.Suite('`_.unescape` string with html entities')
      .add(buildName, '\
        lodash.unescape("`&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;`")'
      )
      .add(otherName, '\
        _.unescape("`&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;`")'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.union`')
      .add(buildName, '\
        lodash.union(numbers, twoNumbers, fourNumbers)'
      )
      .add(otherName, '\
        _.union(numbers, twoNumbers, fourNumbers)'
      )
  );

  suites.push(
    Benchmark.Suite('`_.union` iterating an array of 200 elements')
      .add(buildName, {
        'fn': 'lodash.union(hundredValues, hundredValues2)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.union(hundredValues, hundredValues2)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.uniq`')
      .add(buildName, '\
        lodash.uniq(numbers.concat(twoNumbers, fourNumbers))'
      )
      .add(otherName, '\
        _.uniq(numbers.concat(twoNumbers, fourNumbers))'
      )
  );

  suites.push(
    Benchmark.Suite('`_.uniq` iterating an array of 200 elements')
      .add(buildName, {
        'fn': 'lodash.uniq(twoHundredValues)',
        'teardown': 'function multiArrays(){}'
      })
      .add(otherName, {
        'fn': '_.uniq(twoHundredValues)',
        'teardown': 'function multiArrays(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.uniqBy`')
      .add(buildName, '\
        lodash.uniqBy(numbers.concat(twoNumbers, fourNumbers), function(num) {\
          return num % 2;\
        })'
      )
      .add(otherName, '\
        _.uniqBy(numbers.concat(twoNumbers, fourNumbers), function(num) {\
          return num % 2;\
        })'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.values`')
      .add(buildName, '\
        lodash.values(object)'
      )
      .add(otherName, '\
        _.values(object)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.without`')
      .add(buildName, '\
        lodash.without(numbers, 9, 12, 14, 15)'
      )
      .add(otherName, '\
        _.without(numbers, 9, 12, 14, 15)'
      )
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.wrap` result called')
      .add(buildName, {
        'fn': 'lodashWrapped(2, 5)',
        'teardown': 'function wrap(){}'
      })
      .add(otherName, {
        'fn': '_wrapped(2, 5)',
        'teardown': 'function wrap(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  suites.push(
    Benchmark.Suite('`_.zip`')
      .add(buildName, {
        'fn': 'lodash.zip.apply(lodash, unzipped)',
        'teardown': 'function zip(){}'
      })
      .add(otherName, {
        'fn': '_.zip.apply(_, unzipped)',
        'teardown': 'function zip(){}'
      })
  );

  /*--------------------------------------------------------------------------*/

  if (Benchmark.platform + '') {
    log(Benchmark.platform);
  }
  // Expose `run` to be called later when executing in a browser.
  if (document) {
    root.run = run;
  } else {
    run();
  }
}.call(this));
