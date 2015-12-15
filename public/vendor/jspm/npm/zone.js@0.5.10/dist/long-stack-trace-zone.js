/* */ 
(function e(t, n, r) {
  function s(o, u) {
    if (!n[o]) {
      if (!t[o]) {
        var a = typeof require == "function" && require;
        if (!u && a)
          return a(o, !0);
        if (i)
          return i(o, !0);
        var f = new Error("Cannot find module '" + o + "'");
        throw f.code = "MODULE_NOT_FOUND", f;
      }
      var l = n[o] = {exports: {}};
      t[o][0].call(l.exports, function(e) {
        var n = t[o][1][e];
        return s(n ? n : e);
      }, l, l.exports, e, t, n, r);
    }
    return n[o].exports;
  }
  var i = typeof require == "function" && require;
  for (var o = 0; o < r.length; o++)
    s(r[o]);
  return s;
})({
  1: [function(require, module, exports) {
    (function(global) {
      'use strict';
      if (!global.Zone) {
        throw new Error('zone.js should be installed before loading the long stack trace zone');
      }
      global.Zone.longStackTraceZone = require('../zones/long-stack-trace');
    }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
  }, {"../zones/long-stack-trace.js": 2}],
  2: [function(require, module, exports) {
    (function(global) {
      'use strict';
      function _Stacktrace(e) {
        this._e = e;
      }
      ;
      _Stacktrace.prototype.get = function() {
        if (global.zone.stackFramesFilter && this._e.stack) {
          return this._e.stack.split('\n').filter(global.zone.stackFramesFilter).join('\n');
        }
        return this._e.stack;
      };
      function _getStacktraceWithUncaughtError() {
        return new _Stacktrace(new Error());
      }
      function _getStacktraceWithCaughtError() {
        try {
          throw new Error();
        } catch (e) {
          return new _Stacktrace(e);
        }
      }
      var stack = _getStacktraceWithUncaughtError();
      var _getStacktrace = stack && stack._e.stack ? _getStacktraceWithUncaughtError : _getStacktraceWithCaughtError;
      module.exports = {
        getLongStacktrace: function(exception) {
          var traces = [];
          var currentZone = this;
          if (exception) {
            if (currentZone.stackFramesFilter && exception.stack) {
              traces.push(exception.stack.split('\n').filter(currentZone.stackFramesFilter).join('\n'));
            } else {
              traces.push(exception.stack);
            }
          }
          var now = Date.now();
          while (currentZone && currentZone.constructedAtException) {
            traces.push('--- ' + (Date(currentZone.constructedAtTime)).toString() + ' - ' + (now - currentZone.constructedAtTime) + 'ms ago', currentZone.constructedAtException.get());
            currentZone = currentZone.parent;
          }
          return traces.join('\n');
        },
        stackFramesFilter: function(line) {
          return !/zone(-microtask)?(\.min)?\.js/.test(line);
        },
        onError: function(exception) {
          var reporter = this.reporter || console.log.bind(console);
          reporter(exception.toString());
          reporter(this.getLongStacktrace(exception));
        },
        '$fork': function(parentFork) {
          return function() {
            var newZone = parentFork.apply(this, arguments);
            newZone.constructedAtException = _getStacktrace();
            newZone.constructedAtTime = Date.now();
            return newZone;
          };
        }
      };
    }).call(this, typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {});
  }, {}]
}, {}, [1]);
