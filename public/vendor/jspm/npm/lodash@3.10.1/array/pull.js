/* */ 
var baseIndexOf = require('../internal/baseIndexOf');
var arrayProto = Array.prototype;
var splice = arrayProto.splice;
function pull() {
  var args = arguments,
      array = args[0];
  if (!(array && array.length)) {
    return array;
  }
  var index = 0,
      indexOf = baseIndexOf,
      length = args.length;
  while (++index < length) {
    var fromIndex = 0,
        value = args[index];
    while ((fromIndex = indexOf(array, value, fromIndex)) > -1) {
      splice.call(array, fromIndex, 1);
    }
  }
  return array;
}
module.exports = pull;
