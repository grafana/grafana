/* */ 
'use strict';
var collection_1 = require('../facade/collection');
var lang_1 = require('../facade/lang');
var core_1 = require('../../core');
var test_injector_1 = require('./test_injector');
var utils_1 = require('./utils');
var test_injector_2 = require('./test_injector');
exports.inject = test_injector_2.inject;
var matchers_1 = require('./matchers');
exports.expect = matchers_1.expect;
exports.proxy = function(t) {
  return t;
};
var _global = (typeof window === 'undefined' ? lang_1.global : window);
exports.afterEach = _global.afterEach;
var AsyncTestCompleter = (function() {
  function AsyncTestCompleter(_done) {
    this._done = _done;
  }
  AsyncTestCompleter.prototype.done = function() {
    this._done();
  };
  return AsyncTestCompleter;
})();
exports.AsyncTestCompleter = AsyncTestCompleter;
var jsmBeforeEach = _global.beforeEach;
var jsmDescribe = _global.describe;
var jsmDDescribe = _global.fdescribe;
var jsmXDescribe = _global.xdescribe;
var jsmIt = _global.it;
var jsmIIt = _global.fit;
var jsmXIt = _global.xit;
var runnerStack = [];
var inIt = false;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 500;
var globalTimeOut = utils_1.browserDetection.isSlow ? 3000 : jasmine.DEFAULT_TIMEOUT_INTERVAL;
var testProviders;
var BeforeEachRunner = (function() {
  function BeforeEachRunner(_parent) {
    this._parent = _parent;
    this._fns = [];
  }
  BeforeEachRunner.prototype.beforeEach = function(fn) {
    this._fns.push(fn);
  };
  BeforeEachRunner.prototype.run = function(injector) {
    if (this._parent)
      this._parent.run(injector);
    this._fns.forEach(function(fn) {
      return lang_1.isFunction(fn) ? fn() : fn.execute(injector);
    });
  };
  return BeforeEachRunner;
})();
jsmBeforeEach(function() {
  testProviders = [];
});
function _describe(jsmFn) {
  var args = [];
  for (var _i = 1; _i < arguments.length; _i++) {
    args[_i - 1] = arguments[_i];
  }
  var parentRunner = runnerStack.length === 0 ? null : runnerStack[runnerStack.length - 1];
  var runner = new BeforeEachRunner(parentRunner);
  runnerStack.push(runner);
  var suite = jsmFn.apply(void 0, args);
  runnerStack.pop();
  return suite;
}
function describe() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i - 0] = arguments[_i];
  }
  return _describe.apply(void 0, [jsmDescribe].concat(args));
}
exports.describe = describe;
function ddescribe() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i - 0] = arguments[_i];
  }
  return _describe.apply(void 0, [jsmDDescribe].concat(args));
}
exports.ddescribe = ddescribe;
function xdescribe() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i - 0] = arguments[_i];
  }
  return _describe.apply(void 0, [jsmXDescribe].concat(args));
}
exports.xdescribe = xdescribe;
function beforeEach(fn) {
  if (runnerStack.length > 0) {
    runnerStack[runnerStack.length - 1].beforeEach(fn);
  } else {
    jsmBeforeEach(fn);
  }
}
exports.beforeEach = beforeEach;
function beforeEachProviders(fn) {
  jsmBeforeEach(function() {
    var providers = fn();
    if (!providers)
      return;
    testProviders = testProviders.concat(providers);
  });
}
exports.beforeEachProviders = beforeEachProviders;
function beforeEachBindings(fn) {
  beforeEachProviders(fn);
}
exports.beforeEachBindings = beforeEachBindings;
function _it(jsmFn, name, testFn, testTimeOut) {
  var runner = runnerStack[runnerStack.length - 1];
  var timeOut = lang_1.Math.max(globalTimeOut, testTimeOut);
  if (testFn instanceof test_injector_1.FunctionWithParamTokens) {
    if (testFn.hasToken(AsyncTestCompleter)) {
      jsmFn(name, function(done) {
        var completerProvider = core_1.provide(AsyncTestCompleter, {useFactory: function() {
            if (!inIt)
              throw new Error('AsyncTestCompleter can only be injected in an "it()"');
            return new AsyncTestCompleter(done);
          }});
        var injector = test_injector_1.createTestInjectorWithRuntimeCompiler(testProviders.concat([completerProvider]));
        runner.run(injector);
        inIt = true;
        testFn.execute(injector);
        inIt = false;
      }, timeOut);
    } else {
      jsmFn(name, function() {
        var injector = test_injector_1.createTestInjectorWithRuntimeCompiler(testProviders);
        runner.run(injector);
        testFn.execute(injector);
      }, timeOut);
    }
  } else {
    if (testFn.length === 0) {
      jsmFn(name, function() {
        var injector = test_injector_1.createTestInjectorWithRuntimeCompiler(testProviders);
        runner.run(injector);
        testFn();
      }, timeOut);
    } else {
      jsmFn(name, function(done) {
        var injector = test_injector_1.createTestInjectorWithRuntimeCompiler(testProviders);
        runner.run(injector);
        testFn(done);
      }, timeOut);
    }
  }
}
function it(name, fn, timeOut) {
  if (timeOut === void 0) {
    timeOut = null;
  }
  return _it(jsmIt, name, fn, timeOut);
}
exports.it = it;
function xit(name, fn, timeOut) {
  if (timeOut === void 0) {
    timeOut = null;
  }
  return _it(jsmXIt, name, fn, timeOut);
}
exports.xit = xit;
function iit(name, fn, timeOut) {
  if (timeOut === void 0) {
    timeOut = null;
  }
  return _it(jsmIIt, name, fn, timeOut);
}
exports.iit = iit;
var SpyObject = (function() {
  function SpyObject(type) {
    if (type === void 0) {
      type = null;
    }
    if (type) {
      for (var prop in type.prototype) {
        var m = null;
        try {
          m = type.prototype[prop];
        } catch (e) {}
        if (typeof m === 'function') {
          this.spy(prop);
        }
      }
    }
  }
  SpyObject.prototype.noSuchMethod = function(args) {};
  SpyObject.prototype.spy = function(name) {
    if (!this[name]) {
      this[name] = this._createGuinnessCompatibleSpy(name);
    }
    return this[name];
  };
  SpyObject.prototype.prop = function(name, value) {
    this[name] = value;
  };
  SpyObject.stub = function(object, config, overrides) {
    if (object === void 0) {
      object = null;
    }
    if (config === void 0) {
      config = null;
    }
    if (overrides === void 0) {
      overrides = null;
    }
    if (!(object instanceof SpyObject)) {
      overrides = config;
      config = object;
      object = new SpyObject();
    }
    var m = collection_1.StringMapWrapper.merge(config, overrides);
    collection_1.StringMapWrapper.forEach(m, function(value, key) {
      object.spy(key).andReturn(value);
    });
    return object;
  };
  SpyObject.prototype._createGuinnessCompatibleSpy = function(name) {
    var newSpy = jasmine.createSpy(name);
    newSpy.andCallFake = newSpy.and.callFake;
    newSpy.andReturn = newSpy.and.returnValue;
    newSpy.reset = newSpy.calls.reset;
    newSpy.and.returnValue(null);
    return newSpy;
  };
  return SpyObject;
})();
exports.SpyObject = SpyObject;
function isInInnerZone() {
  return lang_1.global.zone._innerZone === true;
}
exports.isInInnerZone = isInInnerZone;
