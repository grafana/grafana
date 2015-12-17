exports.obj = { circular: 'mess' };
var setter = require('./all-circular3.js');
exports.set = function() {
  setter.setObj();
}
