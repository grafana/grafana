/* */ 
var keys = require('../object/keys');
function assignWith(object, source, customizer) {
  var index = -1,
      props = keys(source),
      length = props.length;
  while (++index < length) {
    var key = props[index],
        value = object[key],
        result = customizer(value, source[key], key, object, source);
    if ((result === result ? (result !== value) : (value === value)) || (value === undefined && !(key in object))) {
      object[key] = result;
    }
  }
  return object;
}
module.exports = assignWith;
