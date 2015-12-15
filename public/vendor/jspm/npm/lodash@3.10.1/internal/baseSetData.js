/* */ 
var identity = require('../utility/identity'),
    metaMap = require('./metaMap');
var baseSetData = !metaMap ? identity : function(func, data) {
  metaMap.set(func, data);
  return func;
};
module.exports = baseSetData;
