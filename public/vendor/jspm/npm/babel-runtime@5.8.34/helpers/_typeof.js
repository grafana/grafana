/* */ 
"use strict";
var _typeof2 = require('./typeof');
var _typeof3 = _interopRequireDefault(_typeof2);
var _symbol = require('../core-js/symbol');
var _symbol2 = _interopRequireDefault(_symbol);
function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {default: obj};
}
exports.default = function(obj) {
  return obj && typeof _symbol2.default !== "undefined" && obj.constructor === _symbol2.default ? "symbol" : typeof obj === "undefined" ? "undefined" : (0, _typeof3.default)(obj);
};
exports.__esModule = true;
