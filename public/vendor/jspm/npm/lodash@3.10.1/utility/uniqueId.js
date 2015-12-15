/* */ 
var baseToString = require('../internal/baseToString');
var idCounter = 0;
function uniqueId(prefix) {
  var id = ++idCounter;
  return baseToString(prefix) + id;
}
module.exports = uniqueId;
