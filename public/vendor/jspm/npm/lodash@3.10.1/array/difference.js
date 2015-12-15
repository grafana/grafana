/* */ 
var baseDifference = require('../internal/baseDifference'),
    baseFlatten = require('../internal/baseFlatten'),
    isArrayLike = require('../internal/isArrayLike'),
    isObjectLike = require('../internal/isObjectLike'),
    restParam = require('../function/restParam');
var difference = restParam(function(array, values) {
  return (isObjectLike(array) && isArrayLike(array)) ? baseDifference(array, baseFlatten(values, false, true)) : [];
});
module.exports = difference;
