/* */ 
var baseGet = require('./baseGet'),
    toPath = require('./toPath');
function basePropertyDeep(path) {
  var pathKey = (path + '');
  path = toPath(path);
  return function(object) {
    return baseGet(object, path, pathKey);
  };
}
module.exports = basePropertyDeep;
