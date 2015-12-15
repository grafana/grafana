/* */ 
var isObject = require('./$.is-object');
require('./$.object-sap')('freeze', function($freeze) {
  return function freeze(it) {
    return $freeze && isObject(it) ? $freeze(it) : it;
  };
});
