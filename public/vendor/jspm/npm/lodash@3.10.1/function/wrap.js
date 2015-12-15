/* */ 
var createWrapper = require('../internal/createWrapper'),
    identity = require('../utility/identity');
var PARTIAL_FLAG = 32;
function wrap(value, wrapper) {
  wrapper = wrapper == null ? identity : wrapper;
  return createWrapper(wrapper, PARTIAL_FLAG, undefined, [value], []);
}
module.exports = wrap;
