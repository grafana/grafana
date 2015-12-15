/* */ 
var baseAssign = require('../internal/baseAssign'),
    baseCreate = require('../internal/baseCreate'),
    isIterateeCall = require('../internal/isIterateeCall');
function create(prototype, properties, guard) {
  var result = baseCreate(prototype);
  if (guard && isIterateeCall(prototype, properties, guard)) {
    properties = undefined;
  }
  return properties ? baseAssign(result, properties) : result;
}
module.exports = create;
