/* */ 
"format cjs";
import {
  isArray
} from "../utils";

import {
  noop,
  resolve,
  reject,
  subscribe,
  PENDING
} from '../-internal';

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  var promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  var promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  var promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  var promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
export default function race(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  var promise = new Constructor(noop);

  if (!isArray(entries)) {
    reject(promise, new TypeError('You must pass an array to race.'));
    return promise;
  }

  var length = entries.length;

  function onFulfillment(value) {
    resolve(promise, value);
  }

  function onRejection(reason) {
    reject(promise, reason);
  }

  for (var i = 0; promise._state === PENDING && i < length; i++) {
    subscribe(Constructor.resolve(entries[i]), undefined, onFulfillment, onRejection);
  }

  return promise;
}
