/* */ 
var merge = require('../object/merge');
function mergeDefaults(objectValue, sourceValue) {
  return objectValue === undefined ? sourceValue : merge(objectValue, sourceValue, mergeDefaults);
}
module.exports = mergeDefaults;
