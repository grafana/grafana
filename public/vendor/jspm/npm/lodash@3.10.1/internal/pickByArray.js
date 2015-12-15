/* */ 
var toObject = require('./toObject');
function pickByArray(object, props) {
  object = toObject(object);
  var index = -1,
      length = props.length,
      result = {};
  while (++index < length) {
    var key = props[index];
    if (key in object) {
      result[key] = object[key];
    }
  }
  return result;
}
module.exports = pickByArray;
