/* */ 
var baseCopy = require('../internal/baseCopy'),
    keysIn = require('../object/keysIn');
function toPlainObject(value) {
  return baseCopy(value, keysIn(value));
}
module.exports = toPlainObject;
