/* */ 
var toInteger = require('./$.to-integer'),
    min = Math.min;
module.exports = function(it) {
  return it > 0 ? min(toInteger(it), 0x1fffffffffffff) : 0;
};
