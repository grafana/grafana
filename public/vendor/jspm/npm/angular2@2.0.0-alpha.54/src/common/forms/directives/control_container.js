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
var ControlContainer = (function(_super) {
  __extends(ControlContainer, _super);
  function ControlContainer() {
    _super.apply(this, arguments);
  }
  Object.defineProperty(ControlContainer.prototype, "formDirective", {
    get: function() {
      return null;
    },
    enumerable: true,
    configurable: true
  });
  Object.defineProperty(ControlContainer.prototype, "path", {
    get: function() {
      return null;
    },
    enumerable: true,
    configurable: true
  });
  return ControlContainer;
})(abstract_control_directive_1.AbstractControlDirective);
exports.ControlContainer = ControlContainer;
