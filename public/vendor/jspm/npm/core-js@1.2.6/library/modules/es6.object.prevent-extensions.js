/* */ 
var isObject = require('./$.is-object');
require('./$.object-sap')('preventExtensions', function($preventExtensions) {
  return function preventExtensions(it) {
    return $preventExtensions && isObject(it) ? $preventExtensions(it) : it;
  };
});
