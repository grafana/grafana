/* */ 
var cof = require('./$.cof');
module.exports = Object('z').propertyIsEnumerable(0) ? Object : function(it) {
  return cof(it) == 'String' ? it.split('') : Object(it);
};
