/* */ 
'use strict';
var lang_1 = require('../../facade/lang');
function forwardRef(forwardRefFn) {
  forwardRefFn.__forward_ref__ = forwardRef;
  forwardRefFn.toString = function() {
    return lang_1.stringify(this());
  };
  return forwardRefFn;
}
exports.forwardRef = forwardRef;
function resolveForwardRef(type) {
  if (lang_1.isFunction(type) && type.hasOwnProperty('__forward_ref__') && type.__forward_ref__ === forwardRef) {
    return type();
  } else {
    return type;
  }
}
exports.resolveForwardRef = resolveForwardRef;
