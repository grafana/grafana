/* */ 
var baseClone = require('../internal/baseClone'),
    bindCallback = require('../internal/bindCallback'),
    isIterateeCall = require('../internal/isIterateeCall');
function clone(value, isDeep, customizer, thisArg) {
  if (isDeep && typeof isDeep != 'boolean' && isIterateeCall(value, isDeep, customizer)) {
    isDeep = false;
  } else if (typeof isDeep == 'function') {
    thisArg = customizer;
    customizer = isDeep;
    isDeep = false;
  }
  return typeof customizer == 'function' ? baseClone(value, isDeep, bindCallback(customizer, thisArg, 3)) : baseClone(value, isDeep);
}
module.exports = clone;
