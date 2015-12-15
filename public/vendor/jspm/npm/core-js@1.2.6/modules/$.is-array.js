/* */ 
var cof = require('./$.cof');
module.exports = Array.isArray || function(arg) {
  return cof(arg) == 'Array';
};
