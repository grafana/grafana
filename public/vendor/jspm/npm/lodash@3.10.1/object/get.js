/* */ 
var baseGet = require('../internal/baseGet'),
    toPath = require('../internal/toPath');
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, toPath(path), (path + ''));
  return result === undefined ? defaultValue : result;
}
module.exports = get;
