/* */ 
"use strict";
var _Symbol = require('../core-js/symbol')["default"];
exports["default"] = function(obj) {
  return obj && obj.constructor === _Symbol ? "symbol" : typeof obj;
};
exports.__esModule = true;
