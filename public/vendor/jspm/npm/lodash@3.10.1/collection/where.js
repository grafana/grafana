/* */ 
var baseMatches = require('../internal/baseMatches'),
    filter = require('./filter');
function where(collection, source) {
  return filter(collection, baseMatches(source));
}
module.exports = where;
