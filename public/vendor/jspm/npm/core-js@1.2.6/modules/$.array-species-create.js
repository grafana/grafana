/* */ 
var isObject = require('./$.is-object'),
    isArray = require('./$.is-array'),
    SPECIES = require('./$.wks')('species');
module.exports = function(original, length) {
  var C;
  if (isArray(original)) {
    C = original.constructor;
    if (typeof C == 'function' && (C === Array || isArray(C.prototype)))
      C = undefined;
    if (isObject(C)) {
      C = C[SPECIES];
      if (C === null)
        C = undefined;
    }
  }
  return new (C === undefined ? Array : C)(length);
};
