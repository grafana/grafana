/* */ 
'use strict';
var utils = require('../utils');
var bindPromiseFn;
if (global.Promise) {
  bindPromiseFn = function(delegate) {
    return function() {
      var delegatePromise = delegate.apply(this, arguments);
      if (delegatePromise instanceof Promise) {
        return delegatePromise;
      }
      return new Promise(function(resolve, reject) {
        delegatePromise.then(resolve, reject);
      });
    };
  };
} else {
  bindPromiseFn = function(delegate) {
    return function() {
      return _patchThenable(delegate.apply(this, arguments));
    };
  };
}
function _patchPromiseFnsOnObject(objectPath, fnNames) {
  var obj = global;
  var exists = objectPath.every(function(segment) {
    obj = obj[segment];
    return obj;
  });
  if (!exists) {
    return;
  }
  fnNames.forEach(function(name) {
    var fn = obj[name];
    if (fn) {
      obj[name] = bindPromiseFn(fn);
    }
  });
}
function _patchThenable(thenable) {
  var then = thenable.then;
  thenable.then = function() {
    var args = utils.bindArguments(arguments);
    var nextThenable = then.apply(thenable, args);
    return _patchThenable(nextThenable);
  };
  var ocatch = thenable.catch;
  thenable.catch = function() {
    var args = utils.bindArguments(arguments);
    var nextThenable = ocatch.apply(thenable, args);
    return _patchThenable(nextThenable);
  };
  return thenable;
}
function apply() {
  if (global.Promise) {
    utils.patchPrototype(Promise.prototype, ['then', 'catch']);
    var patchFns = [[[], ['fetch']], [['Response', 'prototype'], ['arrayBuffer', 'blob', 'json', 'text']]];
    patchFns.forEach(function(objPathAndFns) {
      _patchPromiseFnsOnObject(objPathAndFns[0], objPathAndFns[1]);
    });
  }
}
module.exports = {
  apply: apply,
  bindPromiseFn: bindPromiseFn
};
