/* */ 
var baseCopy = require('./baseCopy'),
    keys = require('../object/keys');
function baseAssign(object, source) {
  return source == null ? object : baseCopy(source, keys(source), object);
}
module.exports = baseAssign;
