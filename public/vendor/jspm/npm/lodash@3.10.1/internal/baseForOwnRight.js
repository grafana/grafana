/* */ 
var baseForRight = require('./baseForRight'),
    keys = require('../object/keys');
function baseForOwnRight(object, iteratee) {
  return baseForRight(object, iteratee, keys);
}
module.exports = baseForOwnRight;
