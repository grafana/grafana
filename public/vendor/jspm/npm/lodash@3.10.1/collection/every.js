/* */ 
var arrayEvery = require('../internal/arrayEvery'),
    baseCallback = require('../internal/baseCallback'),
    baseEvery = require('../internal/baseEvery'),
    isArray = require('../lang/isArray'),
    isIterateeCall = require('../internal/isIterateeCall');
function every(collection, predicate, thisArg) {
  var func = isArray(collection) ? arrayEvery : baseEvery;
  if (thisArg && isIterateeCall(collection, predicate, thisArg)) {
    predicate = undefined;
  }
  if (typeof predicate != 'function' || thisArg !== undefined) {
    predicate = baseCallback(predicate, thisArg, 3);
  }
  return func(collection, predicate);
}
module.exports = every;
