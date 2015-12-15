/* */ 
var baseToString = require('../internal/baseToString');
var nativeMin = Math.min;
function startsWith(string, target, position) {
  string = baseToString(string);
  position = position == null ? 0 : nativeMin(position < 0 ? 0 : (+position || 0), string.length);
  return string.lastIndexOf(target, position) == position;
}
module.exports = startsWith;
