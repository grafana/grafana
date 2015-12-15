/* */ 
var baseDifference = require('../internal/baseDifference'),
    isArrayLike = require('../internal/isArrayLike'),
    restParam = require('../function/restParam');
var without = restParam(function(array, values) {
  return isArrayLike(array) ? baseDifference(array, values) : [];
});
module.exports = without;
