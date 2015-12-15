/* */ 
var baseFor = require('./baseFor'),
    keysIn = require('../object/keysIn');
function baseForIn(object, iteratee) {
  return baseFor(object, iteratee, keysIn);
}
module.exports = baseForIn;
