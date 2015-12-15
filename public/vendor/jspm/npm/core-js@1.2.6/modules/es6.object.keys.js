/* */ 
var toObject = require('./$.to-object');
require('./$.object-sap')('keys', function($keys) {
  return function keys(it) {
    return $keys(toObject(it));
  };
});
