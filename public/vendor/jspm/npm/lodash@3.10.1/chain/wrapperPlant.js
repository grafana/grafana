/* */ 
var baseLodash = require('../internal/baseLodash'),
    wrapperClone = require('../internal/wrapperClone');
function wrapperPlant(value) {
  var result,
      parent = this;
  while (parent instanceof baseLodash) {
    var clone = wrapperClone(parent);
    if (result) {
      previous.__wrapped__ = clone;
    } else {
      result = clone;
    }
    var previous = clone;
    parent = parent.__wrapped__;
  }
  previous.__wrapped__ = value;
  return result;
}
module.exports = wrapperPlant;
