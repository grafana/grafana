/* */ 
var bindCallback = require('./bindCallback'),
    isArray = require('../lang/isArray');
function createForEach(arrayFunc, eachFunc) {
  return function(collection, iteratee, thisArg) {
    return (typeof iteratee == 'function' && thisArg === undefined && isArray(collection)) ? arrayFunc(collection, iteratee) : eachFunc(collection, bindCallback(iteratee, thisArg, 3));
  };
}
module.exports = createForEach;
