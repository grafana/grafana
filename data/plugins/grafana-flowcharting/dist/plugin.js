"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _jquery = _interopRequireDefault(require("jquery"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var plugin = {};
plugin.dirname = "".concat(__dirname, "/");
plugin.repository = 'https://algenty.github.io/flowcharting-repository/';
plugin.mxBasePath = "".concat(plugin.dirname, "libs/mxgraph/javascript/dist/");
plugin.mxImagePath = "".concat(plugin.mxBasePath, "images/");
plugin.partialPath = "".concat(plugin.dirname, "/partials/");
plugin.data = {};

_jquery["default"].ajaxSetup({
  async: false
});

_jquery["default"].getJSON("".concat(plugin.dirname, "/plugin.json"), function (data) {
  plugin.data = data;
});

plugin.getRootPath = function () {
  return this.dirname;
};

plugin.getLibsPath = function () {
  return "".concat(this.dirname, "/libs");
};

plugin.getShapesPath = function () {
  return "".concat(this.dirname, "libs/shapes");
};

plugin.getMxBasePath = function () {
  return this.mxBasePath;
};

plugin.getMxImagePath = function () {
  return this.mxImagePath;
};

plugin.getName = function () {
  return this.data.id;
};

plugin.getPartialPath = function () {
  return this.partialPath;
};

plugin.popover = function (text, tagBook, tagImage) {
  var url = this.repository;
  var images = "".concat(this.repository, "images/");
  var textEncoded = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  var desc = "".concat(textEncoded);
  var book = '';
  var image = '';
  if (tagBook) book = "<a href=\"".concat(url).concat(tagBook, "\" target=\"_blank\"><i class=\"fa fa-book fa-fw\"></i>Help</a>");
  if (tagImage) image = "<a href=\"".concat(images).concat(tagImage, ".png\" target=\"_blank\"><i class=\"fa fa-image fa-fw\"></i>Example</a>");
  return "\n  <div id=\"popover\" style=\"display:flex;flex-wrap:wrap;width: 100%;\">\n    <div style=\"flex:1;height:100px;margin-bottom: 20px;\">".concat(desc, "</div>\n    <div style=\"flex:1;height:100px;margin-bottom: 20px;\">").concat(book, "</div>\n    <div style=\"flex-basis: 100%;height:100px;margin-bottom:20px;\">").concat(image, "</div>\n  </div>");
};

plugin.logLevel = 1;
plugin.logDisplay = false;
window.GF_PLUGIN = window.GF_PLUGIN || plugin;
var _default = plugin;
exports["default"] = _default;
