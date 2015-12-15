/* */ 
var isNumber = require('./isNumber');
function isNaN(value) {
  return isNumber(value) && value != +value;
}
module.exports = isNaN;
