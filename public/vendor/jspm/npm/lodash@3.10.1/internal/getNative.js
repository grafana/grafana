/* */ 
var isNative = require('../lang/isNative');
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}
module.exports = getNative;
