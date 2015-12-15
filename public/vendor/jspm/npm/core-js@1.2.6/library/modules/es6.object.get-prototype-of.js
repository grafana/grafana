/* */ 
var toObject = require('./$.to-object');
require('./$.object-sap')('getPrototypeOf', function($getPrototypeOf) {
  return function getPrototypeOf(it) {
    return $getPrototypeOf(toObject(it));
  };
});
