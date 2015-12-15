/* */ 
var isArray = require('../lang/isArray');
function zipObject(props, values) {
  var index = -1,
      length = props ? props.length : 0,
      result = {};
  if (length && !values && !isArray(props[0])) {
    values = [];
  }
  while (++index < length) {
    var key = props[index];
    if (values) {
      result[key] = values[index];
    } else if (key) {
      result[key[0]] = key[1];
    }
  }
  return result;
}
module.exports = zipObject;
