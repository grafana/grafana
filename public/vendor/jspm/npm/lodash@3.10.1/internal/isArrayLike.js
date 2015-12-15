/* */ 
var getLength = require('./getLength'),
    isLength = require('./isLength');
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}
module.exports = isArrayLike;
