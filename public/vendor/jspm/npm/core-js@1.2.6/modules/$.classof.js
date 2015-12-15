/* */ 
var cof = require('./$.cof'),
    TAG = require('./$.wks')('toStringTag'),
    ARG = cof(function() {
      return arguments;
    }()) == 'Arguments';
module.exports = function(it) {
  var O,
      T,
      B;
  return it === undefined ? 'Undefined' : it === null ? 'Null' : typeof(T = (O = Object(it))[TAG]) == 'string' ? T : ARG ? cof(O) : (B = cof(O)) == 'Object' && typeof O.callee == 'function' ? 'Arguments' : B;
};
