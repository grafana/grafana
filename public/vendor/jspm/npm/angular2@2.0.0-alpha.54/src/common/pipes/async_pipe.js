/* */ 
'use strict';
var __decorate = (this && this.__decorate) || function(decorators, target, key, desc) {
  var c = arguments.length,
      r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
      d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
    r = Reflect.decorate(decorators, target, key, desc);
  else
    for (var i = decorators.length - 1; i >= 0; i--)
      if (d = decorators[i])
        r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function(k, v) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
    return Reflect.metadata(k, v);
};
var lang_1 = require('../../facade/lang');
var async_1 = require('../../facade/async');
var core_1 = require('../../../core');
var invalid_pipe_argument_exception_1 = require('./invalid_pipe_argument_exception');
var ObservableStrategy = (function() {
  function ObservableStrategy() {}
  ObservableStrategy.prototype.createSubscription = function(async, updateLatestValue) {
    return async_1.ObservableWrapper.subscribe(async, updateLatestValue, function(e) {
      throw e;
    });
  };
  ObservableStrategy.prototype.dispose = function(subscription) {
    async_1.ObservableWrapper.dispose(subscription);
  };
  ObservableStrategy.prototype.onDestroy = function(subscription) {
    async_1.ObservableWrapper.dispose(subscription);
  };
  return ObservableStrategy;
})();
var PromiseStrategy = (function() {
  function PromiseStrategy() {}
  PromiseStrategy.prototype.createSubscription = function(async, updateLatestValue) {
    return async.then(updateLatestValue);
  };
  PromiseStrategy.prototype.dispose = function(subscription) {};
  PromiseStrategy.prototype.onDestroy = function(subscription) {};
  return PromiseStrategy;
})();
var _promiseStrategy = new PromiseStrategy();
var _observableStrategy = new ObservableStrategy();
var AsyncPipe = (function() {
  function AsyncPipe(_ref) {
    this._latestValue = null;
    this._latestReturnedValue = null;
    this._subscription = null;
    this._obj = null;
    this._strategy = null;
    this._ref = _ref;
  }
  AsyncPipe.prototype.ngOnDestroy = function() {
    if (lang_1.isPresent(this._subscription)) {
      this._dispose();
    }
  };
  AsyncPipe.prototype.transform = function(obj, args) {
    if (lang_1.isBlank(this._obj)) {
      if (lang_1.isPresent(obj)) {
        this._subscribe(obj);
      }
      return this._latestValue;
    }
    if (obj !== this._obj) {
      this._dispose();
      return this.transform(obj);
    }
    if (this._latestValue === this._latestReturnedValue) {
      return this._latestReturnedValue;
    } else {
      this._latestReturnedValue = this._latestValue;
      return core_1.WrappedValue.wrap(this._latestValue);
    }
  };
  AsyncPipe.prototype._subscribe = function(obj) {
    var _this = this;
    this._obj = obj;
    this._strategy = this._selectStrategy(obj);
    this._subscription = this._strategy.createSubscription(obj, function(value) {
      return _this._updateLatestValue(obj, value);
    });
  };
  AsyncPipe.prototype._selectStrategy = function(obj) {
    if (lang_1.isPromise(obj)) {
      return _promiseStrategy;
    } else if (async_1.ObservableWrapper.isObservable(obj)) {
      return _observableStrategy;
    } else {
      throw new invalid_pipe_argument_exception_1.InvalidPipeArgumentException(AsyncPipe, obj);
    }
  };
  AsyncPipe.prototype._dispose = function() {
    this._strategy.dispose(this._subscription);
    this._latestValue = null;
    this._latestReturnedValue = null;
    this._subscription = null;
    this._obj = null;
  };
  AsyncPipe.prototype._updateLatestValue = function(async, value) {
    if (async === this._obj) {
      this._latestValue = value;
      this._ref.markForCheck();
    }
  };
  AsyncPipe = __decorate([core_1.Pipe({
    name: 'async',
    pure: false
  }), core_1.Injectable(), __metadata('design:paramtypes', [core_1.ChangeDetectorRef])], AsyncPipe);
  return AsyncPipe;
})();
exports.AsyncPipe = AsyncPipe;
