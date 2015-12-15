/* */ 
var getNative = require('../internal/getNative');
var nativeNow = getNative(Date, 'now');
var now = nativeNow || function() {
  return new Date().getTime();
};
module.exports = now;
