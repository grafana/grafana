/* */ 
var baseClone = require('../internal/baseClone'),
    bindCallback = require('../internal/bindCallback');
function cloneDeep(value, customizer, thisArg) {
  return typeof customizer == 'function' ? baseClone(value, true, bindCallback(customizer, thisArg, 3)) : baseClone(value, true);
}
module.exports = cloneDeep;
