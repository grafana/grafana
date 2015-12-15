/* */ 
var baseGet = require('../internal/baseGet'),
    baseSlice = require('../internal/baseSlice'),
    isFunction = require('../lang/isFunction'),
    isKey = require('../internal/isKey'),
    last = require('../array/last'),
    toPath = require('../internal/toPath');
function result(object, path, defaultValue) {
  var result = object == null ? undefined : object[path];
  if (result === undefined) {
    if (object != null && !isKey(path, object)) {
      path = toPath(path);
      object = path.length == 1 ? object : baseGet(object, baseSlice(path, 0, -1));
      result = object == null ? undefined : object[last(path)];
    }
    result = result === undefined ? defaultValue : result;
  }
  return isFunction(result) ? result.call(object) : result;
}
module.exports = result;
