define(function(require, exports) {
  var circular1 = require('./amd-circular1.js');
  exports.fn = function() {
    return circular1.val;
  }
});