/* */ 
var arrayPush = require('./arrayPush'),
    isArguments = require('../lang/isArguments'),
    isArray = require('../lang/isArray'),
    isArrayLike = require('./isArrayLike'),
    isObjectLike = require('./isObjectLike');
function baseFlatten(array, isDeep, isStrict, result) {
  result || (result = []);
  var index = -1,
      length = array.length;
  while (++index < length) {
    var value = array[index];
    if (isObjectLike(value) && isArrayLike(value) && (isStrict || isArray(value) || isArguments(value))) {
      if (isDeep) {
        baseFlatten(value, isDeep, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}
module.exports = baseFlatten;
