/* */ 
(function(process) {
  var restParam = require('../function/restParam'),
      unzipWith = require('./unzipWith');
  var zipWith = restParam(function(arrays) {
    var length = arrays.length,
        iteratee = length > 2 ? arrays[length - 2] : undefined,
        thisArg = length > 1 ? arrays[length - 1] : undefined;
    if (length > 2 && typeof iteratee == 'function') {
      length -= 2;
    } else {
      iteratee = (length > 1 && typeof thisArg == 'function') ? (--length, thisArg) : undefined;
      thisArg = undefined;
    }
    arrays.length = length;
    return unzipWith(arrays, iteratee, thisArg);
  });
  module.exports = zipWith;
})(require('process'));
