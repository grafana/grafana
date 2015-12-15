/* */ 
var isObject = require('./$.is-object');
require('./$.object-sap')('isFrozen', function($isFrozen) {
  return function isFrozen(it) {
    return isObject(it) ? $isFrozen ? $isFrozen(it) : false : true;
  };
});
