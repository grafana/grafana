/* */ 
var baseToString = require('../internal/baseToString');
function capitalize(string) {
  string = baseToString(string);
  return string && (string.charAt(0).toUpperCase() + string.slice(1));
}
module.exports = capitalize;
