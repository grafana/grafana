/* */ 
var isObject = require('../lang/isObject');
function cacheIndexOf(cache, value) {
  var data = cache.data,
      result = (typeof value == 'string' || isObject(value)) ? data.set.has(value) : data.hash[value];
  return result ? 0 : -1;
}
module.exports = cacheIndexOf;
