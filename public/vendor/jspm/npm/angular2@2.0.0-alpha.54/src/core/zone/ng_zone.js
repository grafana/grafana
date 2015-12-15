/* */ 
(function(process) {
  'use strict';
  var collection_1 = require('../../facade/collection');
  var lang_1 = require('../../facade/lang');
  var async_1 = require('../../facade/async');
  var profile_1 = require('../profile/profile');
  var NgZoneError = (function() {
    function NgZoneError(error, stackTrace) {
      this.error = error;
      this.stackTrace = stackTrace;
    }
    return NgZoneError;
  })();
  exports.NgZoneError = NgZoneError;
  var NgZone = (function() {
    function NgZone(_a) {
      var enableLongStackTrace = _a.enableLongStackTrace;
      this._runScope = profile_1.wtfCreateScope("NgZone#run()");
      this._microtaskScope = profile_1.wtfCreateScope("NgZone#microtask()");
      this._pendingMicrotasks = 0;
      this._hasExecutedCodeInInnerZone = false;
      this._nestedRun = 0;
      this._inVmTurnDone = false;
      this._pendingTimeouts = [];
      if (lang_1.global.zone) {
        this._disabled = false;
        this._mountZone = lang_1.global.zone;
        this._innerZone = this._createInnerZone(this._mountZone, enableLongStackTrace);
      } else {
        this._disabled = true;
        this._mountZone = null;
      }
      this._onTurnStartEvents = new async_1.EventEmitter(false);
      this._onTurnDoneEvents = new async_1.EventEmitter(false);
      this._onEventDoneEvents = new async_1.EventEmitter(false);
      this._onErrorEvents = new async_1.EventEmitter(false);
    }
    NgZone.prototype.overrideOnTurnStart = function(onTurnStartHook) {
      this._onTurnStart = lang_1.normalizeBlank(onTurnStartHook);
    };
    Object.defineProperty(NgZone.prototype, "onTurnStart", {
      get: function() {
        return this._onTurnStartEvents;
      },
      enumerable: true,
      configurable: true
    });
    NgZone.prototype._notifyOnTurnStart = function(parentRun) {
      var _this = this;
      parentRun.call(this._innerZone, function() {
        _this._onTurnStartEvents.emit(null);
      });
    };
    NgZone.prototype.overrideOnTurnDone = function(onTurnDoneHook) {
      this._onTurnDone = lang_1.normalizeBlank(onTurnDoneHook);
    };
    Object.defineProperty(NgZone.prototype, "onTurnDone", {
      get: function() {
        return this._onTurnDoneEvents;
      },
      enumerable: true,
      configurable: true
    });
    NgZone.prototype._notifyOnTurnDone = function(parentRun) {
      var _this = this;
      parentRun.call(this._innerZone, function() {
        _this._onTurnDoneEvents.emit(null);
      });
    };
    NgZone.prototype.overrideOnEventDone = function(onEventDoneFn, opt_waitForAsync) {
      var _this = this;
      if (opt_waitForAsync === void 0) {
        opt_waitForAsync = false;
      }
      var normalizedOnEventDone = lang_1.normalizeBlank(onEventDoneFn);
      if (opt_waitForAsync) {
        this._onEventDone = function() {
          if (!_this._pendingTimeouts.length) {
            normalizedOnEventDone();
          }
        };
      } else {
        this._onEventDone = normalizedOnEventDone;
      }
    };
    Object.defineProperty(NgZone.prototype, "onEventDone", {
      get: function() {
        return this._onEventDoneEvents;
      },
      enumerable: true,
      configurable: true
    });
    NgZone.prototype._notifyOnEventDone = function() {
      var _this = this;
      this.runOutsideAngular(function() {
        _this._onEventDoneEvents.emit(null);
      });
    };
    Object.defineProperty(NgZone.prototype, "hasPendingMicrotasks", {
      get: function() {
        return this._pendingMicrotasks > 0;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(NgZone.prototype, "hasPendingTimers", {
      get: function() {
        return this._pendingTimeouts.length > 0;
      },
      enumerable: true,
      configurable: true
    });
    Object.defineProperty(NgZone.prototype, "hasPendingAsyncTasks", {
      get: function() {
        return this.hasPendingMicrotasks || this.hasPendingTimers;
      },
      enumerable: true,
      configurable: true
    });
    NgZone.prototype.overrideOnErrorHandler = function(errorHandler) {
      this._onErrorHandler = lang_1.normalizeBlank(errorHandler);
    };
    Object.defineProperty(NgZone.prototype, "onError", {
      get: function() {
        return this._onErrorEvents;
      },
      enumerable: true,
      configurable: true
    });
    NgZone.prototype.run = function(fn) {
      if (this._disabled) {
        return fn();
      } else {
        var s = this._runScope();
        try {
          return this._innerZone.run(fn);
        } finally {
          profile_1.wtfLeave(s);
        }
      }
    };
    NgZone.prototype.runOutsideAngular = function(fn) {
      if (this._disabled) {
        return fn();
      } else {
        return this._mountZone.run(fn);
      }
    };
    NgZone.prototype._createInnerZone = function(zone, enableLongStackTrace) {
      var microtaskScope = this._microtaskScope;
      var ngZone = this;
      var errorHandling;
      if (enableLongStackTrace) {
        errorHandling = collection_1.StringMapWrapper.merge(Zone.longStackTraceZone, {onError: function(e) {
            ngZone._notifyOnError(this, e);
          }});
      } else {
        errorHandling = {onError: function(e) {
            ngZone._notifyOnError(this, e);
          }};
      }
      return zone.fork(errorHandling).fork({
        '$run': function(parentRun) {
          return function() {
            try {
              ngZone._nestedRun++;
              if (!ngZone._hasExecutedCodeInInnerZone) {
                ngZone._hasExecutedCodeInInnerZone = true;
                ngZone._notifyOnTurnStart(parentRun);
                if (ngZone._onTurnStart) {
                  parentRun.call(ngZone._innerZone, ngZone._onTurnStart);
                }
              }
              return parentRun.apply(this, arguments);
            } finally {
              ngZone._nestedRun--;
              if (ngZone._pendingMicrotasks == 0 && ngZone._nestedRun == 0 && !this._inVmTurnDone) {
                if (ngZone._hasExecutedCodeInInnerZone) {
                  try {
                    this._inVmTurnDone = true;
                    ngZone._notifyOnTurnDone(parentRun);
                    if (ngZone._onTurnDone) {
                      parentRun.call(ngZone._innerZone, ngZone._onTurnDone);
                    }
                  } finally {
                    this._inVmTurnDone = false;
                    ngZone._hasExecutedCodeInInnerZone = false;
                  }
                }
                if (ngZone._pendingMicrotasks === 0) {
                  ngZone._notifyOnEventDone();
                  if (lang_1.isPresent(ngZone._onEventDone)) {
                    ngZone.runOutsideAngular(ngZone._onEventDone);
                  }
                }
              }
            }
          };
        },
        '$scheduleMicrotask': function(parentScheduleMicrotask) {
          return function(fn) {
            ngZone._pendingMicrotasks++;
            var microtask = function() {
              var s = microtaskScope();
              try {
                fn();
              } finally {
                ngZone._pendingMicrotasks--;
                profile_1.wtfLeave(s);
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
              collection_1.ListWrapper.remove(ngZone._pendingTimeouts, id);
            };
            id = parentSetTimeout(cb, delay, args);
            ngZone._pendingTimeouts.push(id);
            return id;
          };
        },
        '$clearTimeout': function(parentClearTimeout) {
          return function(id) {
            parentClearTimeout(id);
            collection_1.ListWrapper.remove(ngZone._pendingTimeouts, id);
          };
        },
        _innerZone: true
      });
    };
    NgZone.prototype._notifyOnError = function(zone, e) {
      if (lang_1.isPresent(this._onErrorHandler) || async_1.ObservableWrapper.hasSubscribers(this._onErrorEvents)) {
        var trace = [lang_1.normalizeBlank(e.stack)];
        while (zone && zone.constructedAtException) {
          trace.push(zone.constructedAtException.get());
          zone = zone.parent;
        }
        if (async_1.ObservableWrapper.hasSubscribers(this._onErrorEvents)) {
          async_1.ObservableWrapper.callEmit(this._onErrorEvents, new NgZoneError(e, trace));
        }
        if (lang_1.isPresent(this._onErrorHandler)) {
          this._onErrorHandler(e, trace);
        }
      } else {
        console.log('## _notifyOnError ##');
        console.log(e.stack);
        throw e;
      }
    };
    return NgZone;
  })();
  exports.NgZone = NgZone;
})(require('process'));
