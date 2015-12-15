/* */ 
'use strict';
var __extends = (this && this.__extends) || function(d, b) {
  for (var p in b)
    if (b.hasOwnProperty(p))
      d[p] = b[p];
  function __() {
    this.constructor = d;
  }
  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var abstract_control_directive_1 = require('./abstract_control_directive');
var exceptions_1 = require('../../../facade/exceptions');
var NgControl = (function(_super) {
  __extends(NgControl, _super);
  function NgControl() {
    _super.apply(this, arguments);
    this.name = null;
    this.valueAccessor = null;
  }
  Object.defineProperty(NgControl.prototype, "validator", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(NgControl.prototype, "asyncValidator", {
    get: function() {
      return exceptions_1.unimplemented();
    },
    enumerable: true,
    configurable: true
  });
  return NgControl;
})(abstract_control_directive_1.AbstractControlDirective);
exports.NgControl = NgControl;
