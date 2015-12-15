/* */ 
var baseClone = require('../internal/baseClone'),
    baseMatchesProperty = require('../internal/baseMatchesProperty');
function matchesProperty(path, srcValue) {
  return baseMatchesProperty(path, baseClone(srcValue, true));
}
module.exports = matchesProperty;
