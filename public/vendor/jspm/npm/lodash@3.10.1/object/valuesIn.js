/* */ 
var baseValues = require('../internal/baseValues'),
    keysIn = require('./keysIn');
function valuesIn(object) {
  return baseValues(object, keysIn(object));
}
module.exports = valuesIn;
