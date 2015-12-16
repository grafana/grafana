define(function(require, exports) {
  var depFunc = require('./amd-circular2.js').fn;
  exports.val = 5;
  exports.outFunc = function() {
    return depFunc();
  }
});