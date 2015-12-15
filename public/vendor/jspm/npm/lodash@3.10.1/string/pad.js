/* */ 
var baseToString = require('../internal/baseToString'),
    createPadding = require('../internal/createPadding');
var nativeCeil = Math.ceil,
    nativeFloor = Math.floor,
    nativeIsFinite = global.isFinite;
function pad(string, length, chars) {
  string = baseToString(string);
  length = +length;
  var strLength = string.length;
  if (strLength >= length || !nativeIsFinite(length)) {
    return string;
  }
  var mid = (length - strLength) / 2,
      leftLength = nativeFloor(mid),
      rightLength = nativeCeil(mid);
  chars = createPadding('', rightLength, chars);
  return chars.slice(0, leftLength) + string + chars;
}
module.exports = pad;
