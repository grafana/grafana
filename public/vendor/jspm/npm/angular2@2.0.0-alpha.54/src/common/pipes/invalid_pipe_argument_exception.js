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
var lang_1 = require('../../facade/lang');
var exceptions_1 = require('../../facade/exceptions');
var InvalidPipeArgumentException = (function(_super) {
  __extends(InvalidPipeArgumentException, _super);
  function InvalidPipeArgumentException(type, value) {
    _super.call(this, "Invalid argument '" + value + "' for pipe '" + lang_1.stringify(type) + "'");
  }
  return InvalidPipeArgumentException;
})(exceptions_1.BaseException);
exports.InvalidPipeArgumentException = InvalidPipeArgumentException;
