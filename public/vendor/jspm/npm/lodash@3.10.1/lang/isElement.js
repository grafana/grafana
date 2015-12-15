/* */ 
var isObjectLike = require('../internal/isObjectLike'),
    isPlainObject = require('./isPlainObject');
function isElement(value) {
  return !!value && value.nodeType === 1 && isObjectLike(value) && !isPlainObject(value);
}
module.exports = isElement;
