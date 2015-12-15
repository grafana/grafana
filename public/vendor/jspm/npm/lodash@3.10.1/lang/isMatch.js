/* */ 
var baseIsMatch = require('../internal/baseIsMatch'),
    bindCallback = require('../internal/bindCallback'),
    getMatchData = require('../internal/getMatchData');
function isMatch(object, source, customizer, thisArg) {
  customizer = typeof customizer == 'function' ? bindCallback(customizer, thisArg, 3) : undefined;
  return baseIsMatch(object, getMatchData(source), customizer);
}
module.exports = isMatch;
