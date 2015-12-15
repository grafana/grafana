/* */ 
var baseCallback = require('./baseCallback'),
    baseReduce = require('./baseReduce'),
    isArray = require('../lang/isArray');
function createReduce(arrayFunc, eachFunc) {
  return function(collection, iteratee, accumulator, thisArg) {
    var initFromArray = arguments.length < 3;
    return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection)) ? arrayFunc(collection, iteratee, accumulator, initFromArray) : baseReduce(collection, baseCallback(iteratee, thisArg, 4), accumulator, initFromArray, eachFunc);
  };
}
module.exports = createReduce;
