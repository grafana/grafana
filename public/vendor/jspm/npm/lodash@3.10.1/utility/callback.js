/* */ 
var baseCallback = require('../internal/baseCallback'),
    isIterateeCall = require('../internal/isIterateeCall'),
    isObjectLike = require('../internal/isObjectLike'),
    matches = require('./matches');
function callback(func, thisArg, guard) {
  if (guard && isIterateeCall(func, thisArg, guard)) {
    thisArg = undefined;
  }
  return isObjectLike(func) ? matches(func) : baseCallback(func, thisArg);
}
module.exports = callback;
