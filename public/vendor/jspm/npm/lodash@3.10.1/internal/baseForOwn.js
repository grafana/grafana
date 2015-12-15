/* */ 
var baseFor = require('./baseFor'),
    keys = require('../object/keys');
function baseForOwn(object, iteratee) {
  return baseFor(object, iteratee, keys);
}
module.exports = baseForOwn;
