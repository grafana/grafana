/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var collection_1 = require('../facade/collection');
var test_injector_1 = require('./test_injector');
var test_injector_2 = require('./test_injector');
exports.inject = test_injector_2.inject;
exports.injectAsync = test_injector_2.injectAsync;
var matchers_1 = require('./matchers');
exports.expect = matchers_1.expect;
var _global = (typeof window === 'undefined' ? lang_1.global : window);
exports.afterEach = _global.afterEach;
exports.describe = _global.describe;
exports.ddescribe = _global.fdescribe;
exports.fdescribe = _global.fdescribe;
exports.xdescribe = _global.xdescribe;
var jsmBeforeEach = _global.beforeEach;
var jsmIt = _global.it;
var jsmIIt = _global.fit;
var jsmXIt = _global.xit;
var testProviders;
var injector;
jsmBeforeEach(function() {
  testProviders = [];
  injector = null;
});
function beforeEachProviders(fn) {
  jsmBeforeEach(function() {
    var providers = fn();
    if (!providers)
      return;
    testProviders = testProviders.concat(providers);
    if (injector !== null) {
      throw new Error('beforeEachProviders was called after the injector had ' + 'been used in a beforeEach or it block. This invalidates the ' + 'test injector');
    }
  });
}
exports.beforeEachProviders = beforeEachProviders;
function _isPromiseLike(input) {
  return input && !!(input.then);
}
function runInTestZone(fnToExecute, finishCallback, failCallback) {
  var pendingMicrotasks = 0;
  var pendingTimeouts = [];
  var ngTestZone = lang_1.global.zone.fork({
    onError: function(e) {
      failCallback(e);
    },
    '$run': function(parentRun) {
      return function() {
        try {
          return parentRun.apply(this, arguments);
        } finally {
          if (pendingMicrotasks == 0 && pendingTimeouts.length == 0) {
            finishCallback();
          }
        }
      };
    },
    '$scheduleMicrotask': function(parentScheduleMicrotask) {
      return function(fn) {
        pendingMicrotasks++;
        var microtask = function() {
          try {
            fn();
          } finally {
            pendingMicrotasks--;
          }
        };
        parentScheduleMicrotask.call(this, microtask);
      };
    },
    '$setTimeout': function(parentSetTimeout) {
      return function(fn, delay) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
          args[_i - 2] = arguments[_i];
        }
        var id;
        var cb = function() {
          fn();
          collection_1.ListWrapper.remove(pendingTimeouts, id);
        };
        id = parentSetTimeout(cb, delay, args);
        pendingTimeouts.push(id);
        return id;
      };
    },
    '$clearTimeout': function(parentClearTimeout) {
      return function(id) {
        parentClearTimeout(id);
        collection_1.ListWrapper.remove(pendingTimeouts, id);
      };
    }
  });
  return ngTestZone.run(fnToExecute);
}
function _it(jsmFn, name, testFn, testTimeOut) {
  var timeOut = testTimeOut;
  if (testFn instanceof test_injector_1.FunctionWithParamTokens) {
    jsmFn(name, function(done) {
      if (!injector) {
        injector = test_injector_1.createTestInjectorWithRuntimeCompiler(testProviders);
      }
      var finishCallback = function() {
        setTimeout(done, 0);
      };
      var returnedTestValue = runInTestZone(function() {
        return testFn.execute(injector);
      }, finishCallback, done.fail);
      if (testFn.isAsync) {
        if (_isPromiseLike(returnedTestValue)) {
          returnedTestValue.then(null, function(err) {
            done.fail(err);
          });
        } else {
          done.fail('Error: injectAsync was expected to return a promise, but the ' + ' returned value was: ' + returnedTestValue);
        }
      } else {
        if (!(returnedTestValue === undefined)) {
          done.fail('Error: inject returned a value. Did you mean to use injectAsync? Returned ' + 'value was: ' + returnedTestValue);
        }
      }
    }, timeOut);
  } else {
    jsmFn(name, testFn, timeOut);
  }
}
function beforeEach(fn) {
  if (fn instanceof test_injector_1.FunctionWithParamTokens) {
    jsmBeforeEach(function(done) {
      var finishCallback = function() {
        setTimeout(done, 0);
      };
      if (!injector) {
        injector = test_injector_1.createTestInjectorWithRuntimeCompiler(testProviders);
      }
      var returnedTestValue = runInTestZone(function() {
        return fn.execute(injector);
      }, finishCallback, done.fail);
      if (fn.isAsync) {
        if (_isPromiseLike(returnedTestValue)) {
          returnedTestValue.then(null, function(err) {
            done.fail(err);
          });
        } else {
          done.fail('Error: injectAsync was expected to return a promise, but the ' + ' returned value was: ' + returnedTestValue);
        }
      } else {
        if (!(returnedTestValue === undefined)) {
          done.fail('Error: inject returned a value. Did you mean to use injectAsync? Returned ' + 'value was: ' + returnedTestValue);
        }
      }
    });
  } else {
    if (fn.length === 0) {
      jsmBeforeEach(function() {
        fn();
      });
    } else {
      jsmBeforeEach(function(done) {
        fn(done);
      });
    }
  }
}
exports.beforeEach = beforeEach;
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
function fit(name, fn, timeOut) {
  if (timeOut === void 0) {
    timeOut = null;
  }
  return _it(jsmIIt, name, fn, timeOut);
}
exports.fit = fit;
