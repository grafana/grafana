/* */ 
var isSpace = require('./isSpace');
function trimmedRightIndex(string) {
  var index = string.length;
  while (index-- && isSpace(string.charCodeAt(index))) {}
  return index;
}
module.exports = trimmedRightIndex;
