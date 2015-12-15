/* */ 
var before = require('./before');
function once(func) {
  return before(2, func);
}
module.exports = once;
