/* */ 
var baseCallback = require('./baseCallback'),
    baseFind = require('./baseFind');
function createFindKey(objectFunc) {
  return function(object, predicate, thisArg) {
    predicate = baseCallback(predicate, thisArg, 3);
    return baseFind(object, predicate, objectFunc, true);
  };
}
module.exports = createFindKey;
