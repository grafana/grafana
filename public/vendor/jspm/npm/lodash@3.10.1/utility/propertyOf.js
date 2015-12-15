/* */ 
var baseGet = require('../internal/baseGet'),
    toPath = require('../internal/toPath');
function propertyOf(object) {
  return function(path) {
    return baseGet(object, toPath(path), (path + ''));
  };
}
module.exports = propertyOf;
