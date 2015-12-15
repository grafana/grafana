/* */ 
var createWrapper = require('./createWrapper'),
    isIterateeCall = require('./isIterateeCall');
function createCurry(flag) {
  function curryFunc(func, arity, guard) {
    if (guard && isIterateeCall(func, arity, guard)) {
      arity = undefined;
    }
    var result = createWrapper(func, flag, undefined, undefined, undefined, undefined, undefined, arity);
    result.placeholder = curryFunc.placeholder;
    return result;
  }
  return curryFunc;
}
module.exports = createCurry;
