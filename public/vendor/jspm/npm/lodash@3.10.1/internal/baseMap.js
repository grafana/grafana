/* */ 
var baseEach = require('./baseEach'),
    isArrayLike = require('./isArrayLike');
function baseMap(collection, iteratee) {
  var index = -1,
      result = isArrayLike(collection) ? Array(collection.length) : [];
  baseEach(collection, function(value, key, collection) {
    result[++index] = iteratee(value, key, collection);
  });
  return result;
}
module.exports = baseMap;
