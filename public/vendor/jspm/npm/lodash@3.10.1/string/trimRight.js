/* */ 
var baseToString = require('../internal/baseToString'),
    charsRightIndex = require('../internal/charsRightIndex'),
    isIterateeCall = require('../internal/isIterateeCall'),
    trimmedRightIndex = require('../internal/trimmedRightIndex');
function trimRight(string, chars, guard) {
  var value = string;
  string = baseToString(string);
  if (!string) {
    return string;
  }
  if (guard ? isIterateeCall(value, chars, guard) : chars == null) {
    return string.slice(0, trimmedRightIndex(string) + 1);
  }
  return string.slice(0, charsRightIndex(string, (chars + '')) + 1);
}
module.exports = trimRight;
