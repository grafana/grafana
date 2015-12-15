/* */ 
"use strict";
var _Symbol$hasInstance = require('../core-js/symbol/has-instance')["default"];
exports["default"] = function(left, right) {
  if (right != null && right[_Symbol$hasInstance]) {
    return right[_Symbol$hasInstance](left);
  } else {
    return left instanceof right;
  }
};
exports.__esModule = true;
