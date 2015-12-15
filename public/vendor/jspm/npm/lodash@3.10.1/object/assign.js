/* */ 
var assignWith = require('../internal/assignWith'),
    baseAssign = require('../internal/baseAssign'),
    createAssigner = require('../internal/createAssigner');
var assign = createAssigner(function(object, source, customizer) {
  return customizer ? assignWith(object, source, customizer) : baseAssign(object, source);
});
module.exports = assign;
