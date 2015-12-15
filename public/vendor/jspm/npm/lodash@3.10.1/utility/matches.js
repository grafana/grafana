/* */ 
var baseClone = require('../internal/baseClone'),
    baseMatches = require('../internal/baseMatches');
function matches(source) {
  return baseMatches(baseClone(source, true));
}
module.exports = matches;
