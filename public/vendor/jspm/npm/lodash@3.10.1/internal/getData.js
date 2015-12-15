/* */ 
var metaMap = require('./metaMap'),
    noop = require('../utility/noop');
var getData = !metaMap ? noop : function(func) {
  return metaMap.get(func);
};
module.exports = getData;
