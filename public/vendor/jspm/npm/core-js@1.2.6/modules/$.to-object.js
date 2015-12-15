/* */ 
var defined = require('./$.defined');
module.exports = function(it) {
  return Object(defined(it));
};
