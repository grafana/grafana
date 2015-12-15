/* */ 
var createCtorWrapper = require('./createCtorWrapper');
function createBindWrapper(func, thisArg) {
  var Ctor = createCtorWrapper(func);
  function wrapper() {
    var fn = (this && this !== global && this instanceof wrapper) ? Ctor : func;
    return fn.apply(thisArg, arguments);
  }
  return wrapper;
}
module.exports = createBindWrapper;
