/* */ 
(function(process) {
  var isArrayLike = require('./isArrayLike'),
      isObject = require('../lang/isObject'),
      values = require('../object/values');
  function toIterable(value) {
    if (value == null) {
      return [];
    }
    if (!isArrayLike(value)) {
      return values(value);
    }
    return isObject(value) ? value : Object(value);
  }
  module.exports = toIterable;
})(require('process'));
