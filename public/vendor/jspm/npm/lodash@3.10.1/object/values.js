/* */ 
var baseValues = require('../internal/baseValues'),
    keys = require('./keys');
function values(object) {
  return baseValues(object, keys(object));
}
module.exports = values;
