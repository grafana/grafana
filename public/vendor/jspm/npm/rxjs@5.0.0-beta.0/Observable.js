/* */ 
var Subscriber_1 = require('./Subscriber');
var root_1 = require('./util/root');
var SymbolShim_1 = require('./util/SymbolShim');
var rxSubscriber_1 = require('./symbol/rxSubscriber');
var Observable = (function() {
  function Observable(subscribe) {
    this._isScalar = false;
    if (subscribe) {
      this._subscribe = subscribe;
    }
  }
  Observable.prototype.lift = function(operator) {
    var observable = new Observable();
    observable.source = this;
    observable.operator = operator;
    return observable;
  };
  Observable.prototype[SymbolShim_1.SymbolShim.observable] = function() {
    return this;
  };
  Observable.prototype.subscribe = function(observerOrNext, error, complete) {
    var subscriber;
    if (observerOrNext && typeof observerOrNext === 'object') {
      if (observerOrNext instanceof Subscriber_1.Subscriber) {
        subscriber = observerOrNext;
      } else if (observerOrNext[rxSubscriber_1.rxSubscriber]) {
        subscriber = observerOrNext[rxSubscriber_1.rxSubscriber]();
      } else {
        subscriber = new Subscriber_1.Subscriber(observerOrNext);
      }
    } else {
      var next = observerOrNext;
      subscriber = Subscriber_1.Subscriber.create(next, error, complete);
    }
    subscriber.add(this._subscribe(subscriber));
    return subscriber;
  };
  Observable.prototype.forEach = function(next, thisArg, PromiseCtor) {
    if (!PromiseCtor) {
      if (root_1.root.Rx && root_1.root.Rx.config && root_1.root.Rx.config.Promise) {
        PromiseCtor = root_1.root.Rx.config.Promise;
      } else if (root_1.root.Promise) {
        PromiseCtor = root_1.root.Promise;
      }
    }
    if (!PromiseCtor) {
      throw new Error('no Promise impl found');
    }
    var nextHandler;
    if (thisArg) {
      nextHandler = function nextHandlerFn(value) {
        var _a = nextHandlerFn,
            thisArg = _a.thisArg,
            next = _a.next;
        return next.call(thisArg, value);
      };
      nextHandler.thisArg = thisArg;
      nextHandler.next = next;
    } else {
      nextHandler = next;
    }
    var promiseCallback = function promiseCallbackFn(resolve, reject) {
      var _a = promiseCallbackFn,
          source = _a.source,
          nextHandler = _a.nextHandler;
      source.subscribe(nextHandler, reject, resolve);
    };
    promiseCallback.source = this;
    promiseCallback.nextHandler = nextHandler;
    return new PromiseCtor(promiseCallback);
  };
  Observable.prototype._subscribe = function(subscriber) {
    return this.source._subscribe(this.operator.call(subscriber));
  };
  Observable.create = function(subscribe) {
    return new Observable(subscribe);
  };
  return Observable;
})();
exports.Observable = Observable;
