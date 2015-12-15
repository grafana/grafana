/* */ 
var createWrapper = require('../internal/createWrapper'),
    isIterateeCall = require('../internal/isIterateeCall');
var ARY_FLAG = 128;
var nativeMax = Math.max;
function ary(func, n, guard) {
  if (guard && isIterateeCall(func, n, guard)) {
    n = undefined;
  }
  n = (func && n == null) ? func.length : nativeMax(+n || 0, 0);
  return createWrapper(func, ARY_FLAG, undefined, undefined, undefined, undefined, n);
}
module.exports = ary;
