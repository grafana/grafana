/* */ 
'use strict';
var lang_1 = require('../facade/lang');
var exceptions_1 = require('../facade/exceptions');
var collection_1 = require('../facade/collection');
var _scheduler;
var _microtasks = [];
var _pendingPeriodicTimers = [];
var _pendingTimers = [];
function fakeAsync(fn) {
  if (lang_1.global.zone._inFakeAsyncZone) {
    throw new Error('fakeAsync() calls can not be nested');
  }
  var fakeAsyncZone = lang_1.global.zone.fork({
    setTimeout: _setTimeout,
    clearTimeout: _clearTimeout,
    setInterval: _setInterval,
    clearInterval: _clearInterval,
    scheduleMicrotask: _scheduleMicrotask,
    _inFakeAsyncZone: true
  });
  return function() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i - 0] = arguments[_i];
    }
    _scheduler = new jasmine.DelayedFunctionScheduler();
    clearPendingTimers();
    var res = fakeAsyncZone.run(function() {
      var res = fn.apply(void 0, args);
      flushMicrotasks();
      return res;
    });
    if (_pendingPeriodicTimers.length > 0) {
      throw new exceptions_1.BaseException(_pendingPeriodicTimers.length + " periodic timer(s) still in the queue.");
    }
    if (_pendingTimers.length > 0) {
      throw new exceptions_1.BaseException(_pendingTimers.length + " timer(s) still in the queue.");
    }
    _scheduler = null;
    collection_1.ListWrapper.clear(_microtasks);
    return res;
  };
}
exports.fakeAsync = fakeAsync;
function clearPendingTimers() {
  collection_1.ListWrapper.clear(_microtasks);
  collection_1.ListWrapper.clear(_pendingPeriodicTimers);
  collection_1.ListWrapper.clear(_pendingTimers);
}
exports.clearPendingTimers = clearPendingTimers;
function tick(millis) {
  if (millis === void 0) {
    millis = 0;
  }
  _assertInFakeAsyncZone();
  flushMicrotasks();
  _scheduler.tick(millis);
}
exports.tick = tick;
function flushMicrotasks() {
  _assertInFakeAsyncZone();
  while (_microtasks.length > 0) {
    var microtask = collection_1.ListWrapper.removeAt(_microtasks, 0);
    microtask();
  }
}
exports.flushMicrotasks = flushMicrotasks;
function _setTimeout(fn, delay) {
  var args = [];
  for (var _i = 2; _i < arguments.length; _i++) {
    args[_i - 2] = arguments[_i];
  }
  var cb = _fnAndFlush(fn);
  var id = _scheduler.scheduleFunction(cb, delay, args);
  _pendingTimers.push(id);
  _scheduler.scheduleFunction(_dequeueTimer(id), delay);
  return id;
}
function _clearTimeout(id) {
  _dequeueTimer(id);
  return _scheduler.removeFunctionWithId(id);
}
function _setInterval(fn, interval) {
  var args = [];
  for (var _i = 2; _i < arguments.length; _i++) {
    args[_i - 2] = arguments[_i];
  }
  var cb = _fnAndFlush(fn);
  var id = _scheduler.scheduleFunction(cb, interval, args, true);
  _pendingPeriodicTimers.push(id);
  return id;
}
function _clearInterval(id) {
  collection_1.ListWrapper.remove(_pendingPeriodicTimers, id);
  return _scheduler.removeFunctionWithId(id);
}
function _fnAndFlush(fn) {
  return function() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i - 0] = arguments[_i];
    }
    fn.apply(lang_1.global, args);
    flushMicrotasks();
  };
}
function _scheduleMicrotask(microtask) {
  _microtasks.push(microtask);
}
function _dequeueTimer(id) {
  return function() {
    collection_1.ListWrapper.remove(_pendingTimers, id);
  };
}
function _assertInFakeAsyncZone() {
  if (!lang_1.global.zone || !lang_1.global.zone._inFakeAsyncZone) {
    throw new Error('The code should be running in the fakeAsync zone to call this function');
  }
}
