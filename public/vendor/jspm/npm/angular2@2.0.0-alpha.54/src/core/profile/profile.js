/* */ 
'use strict';
var impl = require('./wtf_impl');
exports.wtfEnabled = impl.detectWTF();
function noopScope(arg0, arg1) {
  return null;
}
exports.wtfCreateScope = exports.wtfEnabled ? impl.createScope : function(signature, flags) {
  return noopScope;
};
exports.wtfLeave = exports.wtfEnabled ? impl.leave : function(s, r) {
  return r;
};
exports.wtfStartTimeRange = exports.wtfEnabled ? impl.startTimeRange : function(rangeType, action) {
  return null;
};
exports.wtfEndTimeRange = exports.wtfEnabled ? impl.endTimeRange : function(r) {
  return null;
};
