/* */ 
var baseMatches = require('../internal/baseMatches'),
    find = require('./find');
function findWhere(collection, source) {
  return find(collection, baseMatches(source));
}
module.exports = findWhere;
