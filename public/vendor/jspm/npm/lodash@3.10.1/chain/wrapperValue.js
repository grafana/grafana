/* */ 
var baseWrapperValue = require('../internal/baseWrapperValue');
function wrapperValue() {
  return baseWrapperValue(this.__wrapped__, this.__actions__);
}
module.exports = wrapperValue;
