/* */ 
var isIterateeCall = require('../internal/isIterateeCall'),
    trim = require('./trim');
var reHasHexPrefix = /^0[xX]/;
var nativeParseInt = global.parseInt;
function parseInt(string, radix, guard) {
  if (guard ? isIterateeCall(string, radix, guard) : radix == null) {
    radix = 0;
  } else if (radix) {
    radix = +radix;
  }
  string = trim(string);
  return nativeParseInt(string, radix || (reHasHexPrefix.test(string) ? 16 : 10));
}
module.exports = parseInt;
