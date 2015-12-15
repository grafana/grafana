/* */ 
"use strict";
var _Array$from = require('../core-js/array/from')["default"];
exports["default"] = function(arr) {
  return Array.isArray(arr) ? arr : _Array$from(arr);
};
exports.__esModule = true;
