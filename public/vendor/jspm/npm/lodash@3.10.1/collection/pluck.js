/* */ 
var map = require('./map'),
    property = require('../utility/property');
function pluck(collection, path) {
  return map(collection, property(path));
}
module.exports = pluck;
