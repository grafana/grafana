/* */ 
var baseEach = require('./baseEach');
function baseSum(collection, iteratee) {
  var result = 0;
  baseEach(collection, function(value, index, collection) {
    result += +iteratee(value, index, collection) || 0;
  });
  return result;
}
module.exports = baseSum;
