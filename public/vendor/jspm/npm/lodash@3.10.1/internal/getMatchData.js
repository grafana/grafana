/* */ 
var isStrictComparable = require('./isStrictComparable'),
    pairs = require('../object/pairs');
function getMatchData(object) {
  var result = pairs(object),
      length = result.length;
  while (length--) {
    result[length][2] = isStrictComparable(result[length][1]);
  }
  return result;
}
module.exports = getMatchData;
