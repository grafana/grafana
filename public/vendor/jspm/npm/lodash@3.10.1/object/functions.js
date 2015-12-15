/* */ 
var baseFunctions = require('../internal/baseFunctions'),
    keysIn = require('./keysIn');
function functions(object) {
  return baseFunctions(object, keysIn(object));
}
module.exports = functions;
