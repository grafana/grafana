/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// istanbul ignore next

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// istanbul ignore next

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _default = require("./_default");

var _default2 = _interopRequireDefault(_default);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var IgnoreFormatter = (function (_DefaultFormatter) {
  _inherits(IgnoreFormatter, _DefaultFormatter);

  function IgnoreFormatter() {
    _classCallCheck(this, IgnoreFormatter);

    _DefaultFormatter.apply(this, arguments);
  }

  /**
   * [Please add a description.]
   */

  IgnoreFormatter.prototype.exportDeclaration = function exportDeclaration(node, nodes) {
    var declar = t.toStatement(node.declaration, true);
    if (declar) nodes.push(t.inherits(declar, node));
  };

  /**
   * [Please add a description.]
   */

  IgnoreFormatter.prototype.exportAllDeclaration = function exportAllDeclaration() {};

  IgnoreFormatter.prototype.importDeclaration = function importDeclaration() {};

  IgnoreFormatter.prototype.importSpecifier = function importSpecifier() {};

  IgnoreFormatter.prototype.exportSpecifier = function exportSpecifier() {};

  IgnoreFormatter.prototype.transform = function transform() {};

  return IgnoreFormatter;
})(_default2["default"]);

exports["default"] = IgnoreFormatter;
module.exports = exports["default"];