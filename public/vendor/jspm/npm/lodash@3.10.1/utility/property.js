/* */ 
var baseProperty = require('../internal/baseProperty'),
    basePropertyDeep = require('../internal/basePropertyDeep'),
    isKey = require('../internal/isKey');
function property(path) {
  return isKey(path) ? baseProperty(path) : basePropertyDeep(path);
}
module.exports = property;
