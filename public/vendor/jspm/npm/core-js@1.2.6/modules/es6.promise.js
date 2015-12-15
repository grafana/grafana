/* */ 
(function(process) {
  'use strict';
  var $ = require('./$'),
      LIBRARY = require('./$.library'),
      global = require('./$.global'),
      ctx = require('./$.ctx'),
      classof = require('./$.classof'),
      $export = require('./$.export'),
      isObject = require('./$.is-object'),
      anObject = require('./$.an-object'),
      aFunction = require('./$.a-function'),
      strictNew = require('./$.strict-new'),
      forOf = require('./$.for-of'),
      setProto = require('./$.set-proto').set,
      same = require('./$.same-value'),
      SPECIES = require('./$.wks')('species'),
      speciesConstructor = require('./$.species-constructor'),
      asap = require('./$.microtask'),
      PROMISE = 'Promise',
      process = global.process,
      isNode = classof(process) == 'process',
      P = global[PROMISE],
      Wrapper;
  var testResolve = function(sub) {
    var test = new P(function() {});
    if (sub)
      test.constructor = Object;
    return P.resolve(test) === test;
  };
  var USE_NATIVE = function() {
    var works = false;
    function P2(x) {
      var self = new P(x);
      setProto(self, P2.prototype);
      return self;
    }
    try {
      works = P && P.resolve && testResolve();
      setProto(P2, P);
      P2.prototype = $.create(P.prototype, {constructor: {value: P2}});
      if (!(P2.resolve(5).then(function() {}) instanceof P2)) {
        works = false;
      }
      if (works && require('./$.descriptors')) {
        var thenableThenGotten = false;
        P.resolve($.setDesc({}, 'then', {get: function() {
            thenableThenGotten = true;
          }}));
        works = thenableThenGotten;
      }
    } catch (e) {
      works = false;
    }
    return works;
  }();
  var sameConstructor = function(a, b) {
    if (LIBRARY && a === P && b === Wrapper)
      return true;
    return same(a, b);
  };
  var getConstructor = function(C) {
    var S = anObject(C)[SPECIES];
    return S != undefined ? S : C;
  };
  var isThenable = function(it) {
    var then;
    return isObject(it) && typeof(then = it.then) == 'function' ? then : false;
  };
  var PromiseCapability = function(C) {
    var resolve,
        reject;
    this.promise = new C(function($$resolve, $$reject) {
      if (resolve !== undefined || reject !== undefined)
        throw TypeError('Bad Promise constructor');
      resolve = $$resolve;
      reject = $$reject;
    });
    this.resolve = aFunction(resolve), this.reject = aFunction(reject);
  };
  var perform = function(exec) {
    try {
      exec();
    } catch (e) {
      return {error: e};
    }
  };
  var notify = function(record, isReject) {
    if (record.n)
      return;
    record.n = true;
    var chain = record.c;
    asap(function() {
      var value = record.v,
          ok = record.s == 1,
          i = 0;
      var run = function(reaction) {
        var handler = ok ? reaction.ok : reaction.fail,
            resolve = reaction.resolve,
            reject = reaction.reject,
            result,
            then;
        try {
          if (handler) {
            if (!ok)
              record.h = true;
            result = handler === true ? value : handler(value);
            if (result === reaction.promise) {
              reject(TypeError('Promise-chain cycle'));
            } else if (then = isThenable(result)) {
              then.call(result, resolve, reject);
            } else
              resolve(result);
          } else
            reject(value);
        } catch (e) {
          reject(e);
        }
      };
      while (chain.length > i)
        run(chain[i++]);
      chain.length = 0;
      record.n = false;
      if (isReject)
        setTimeout(function() {
          var promise = record.p,
              handler,
              console;
          if (isUnhandled(promise)) {
            if (isNode) {
              process.emit('unhandledRejection', value, promise);
            } else if (handler = global.onunhandledrejection) {
              handler({
                promise: promise,
                reason: value
              });
            } else if ((console = global.console) && console.error) {
              console.error('Unhandled promise rejection', value);
            }
          }
          record.a = undefined;
        }, 1);
    });
  };
  var isUnhandled = function(promise) {
    var record = promise._d,
        chain = record.a || record.c,
        i = 0,
        reaction;
    if (record.h)
      return false;
    while (chain.length > i) {
      reaction = chain[i++];
      if (reaction.fail || !isUnhandled(reaction.promise))
        return false;
    }
    return true;
  };
  var $reject = function(value) {
    var record = this;
    if (record.d)
      return;
    record.d = true;
    record = record.r || record;
    record.v = value;
    record.s = 2;
    record.a = record.c.slice();
    notify(record, true);
  };
  var $resolve = function(value) {
    var record = this,
        then;
    if (record.d)
      return;
    record.d = true;
    record = record.r || record;
    try {
      if (record.p === value)
        throw TypeError("Promise can't be resolved itself");
      if (then = isThenable(value)) {
        asap(function() {
          var wrapper = {
            r: record,
            d: false
          };
          try {
            then.call(value, ctx($resolve, wrapper, 1), ctx($reject, wrapper, 1));
          } catch (e) {
            $reject.call(wrapper, e);
          }
        });
      } else {
        record.v = value;
        record.s = 1;
        notify(record, false);
      }
    } catch (e) {
      $reject.call({
        r: record,
        d: false
      }, e);
    }
  };
  if (!USE_NATIVE) {
    P = function Promise(executor) {
      aFunction(executor);
      var record = this._d = {
        p: strictNew(this, P, PROMISE),
        c: [],
        a: undefined,
        s: 0,
        d: false,
        v: undefined,
        h: false,
        n: false
      };
      try {
        executor(ctx($resolve, record, 1), ctx($reject, record, 1));
      } catch (err) {
        $reject.call(record, err);
      }
    };
    require('./$.redefine-all')(P.prototype, {
      then: function then(onFulfilled, onRejected) {
        var reaction = new PromiseCapability(speciesConstructor(this, P)),
            promise = reaction.promise,
            record = this._d;
        reaction.ok = typeof onFulfilled == 'function' ? onFulfilled : true;
        reaction.fail = typeof onRejected == 'function' && onRejected;
        record.c.push(reaction);
        if (record.a)
          record.a.push(reaction);
        if (record.s)
          notify(record, false);
        return promise;
      },
      'catch': function(onRejected) {
        return this.then(undefined, onRejected);
      }
    });
  }
  $export($export.G + $export.W + $export.F * !USE_NATIVE, {Promise: P});
  require('./$.set-to-string-tag')(P, PROMISE);
  require('./$.set-species')(PROMISE);
  Wrapper = require('./$.core')[PROMISE];
  $export($export.S + $export.F * !USE_NATIVE, PROMISE, {reject: function reject(r) {
      var capability = new PromiseCapability(this),
          $$reject = capability.reject;
      $$reject(r);
      return capability.promise;
    }});
  $export($export.S + $export.F * (!USE_NATIVE || testResolve(true)), PROMISE, {resolve: function resolve(x) {
      if (x instanceof P && sameConstructor(x.constructor, this))
        return x;
      var capability = new PromiseCapability(this),
          $$resolve = capability.resolve;
      $$resolve(x);
      return capability.promise;
    }});
  $export($export.S + $export.F * !(USE_NATIVE && require('./$.iter-detect')(function(iter) {
    P.all(iter)['catch'](function() {});
  })), PROMISE, {
    all: function all(iterable) {
      var C = getConstructor(this),
          capability = new PromiseCapability(C),
          resolve = capability.resolve,
          reject = capability.reject,
          values = [];
      var abrupt = perform(function() {
        forOf(iterable, false, values.push, values);
        var remaining = values.length,
            results = Array(remaining);
        if (remaining)
          $.each.call(values, function(promise, index) {
            var alreadyCalled = false;
            C.resolve(promise).then(function(value) {
              if (alreadyCalled)
                return;
              alreadyCalled = true;
              results[index] = value;
              --remaining || resolve(results);
            }, reject);
          });
        else
          resolve(results);
      });
      if (abrupt)
        reject(abrupt.error);
      return capability.promise;
    },
    race: function race(iterable) {
      var C = getConstructor(this),
          capability = new PromiseCapability(C),
          reject = capability.reject;
      var abrupt = perform(function() {
        forOf(iterable, false, function(promise) {
          C.resolve(promise).then(capability.resolve, reject);
        });
      });
      if (abrupt)
        reject(abrupt.error);
      return capability.promise;
    }
  });
})(require('process'));
