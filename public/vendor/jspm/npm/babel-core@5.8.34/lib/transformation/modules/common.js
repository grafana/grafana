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

var _util = require("../../util");

var util = _interopRequireWildcard(_util);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var CommonJSFormatter = (function (_DefaultFormatter) {
  _inherits(CommonJSFormatter, _DefaultFormatter);

  function CommonJSFormatter() {
    _classCallCheck(this, CommonJSFormatter);

    _DefaultFormatter.apply(this, arguments);
  }

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype.setup = function setup() {
    this._setup(this.hasLocalExports);
  };

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype._setup = function _setup(conditional) {
    var file = this.file;
    var scope = file.scope;

    scope.rename("module");
    scope.rename("exports");

    if (!this.noInteropRequireImport && conditional) {
      var templateName = "exports-module-declaration";
      if (this.file.isLoose("es6.modules")) templateName += "-loose";
      var declar = util.template(templateName, true);
      declar._blockHoist = 3;
      file.path.unshiftContainer("body", [declar]);
    }
  };

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype.transform = function transform(program) {
    _default2["default"].prototype.transform.apply(this, arguments);

    if (this.hasDefaultOnlyExport) {
      program.body.push(t.expressionStatement(t.assignmentExpression("=", t.memberExpression(t.identifier("module"), t.identifier("exports")), t.memberExpression(t.identifier("exports"), t.identifier("default")))));
    }
  };

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype.importSpecifier = function importSpecifier(specifier, node, nodes, scope) {
    var variableName = specifier.local;

    var ref = this.getExternalReference(node, nodes);

    // import foo from "foo";
    if (t.isSpecifierDefault(specifier)) {
      if (this.isModuleType(node, "absolute")) {
        // absolute module reference
      } else if (this.isModuleType(node, "absoluteDefault")) {
          this.remaps.add(scope, variableName.name, ref);
        } else if (this.noInteropRequireImport) {
          this.remaps.add(scope, variableName.name, t.memberExpression(ref, t.identifier("default")));
        } else {
          var uid = this.scope.generateUidIdentifierBasedOnNode(node, "import");

          nodes.push(t.variableDeclaration("var", [t.variableDeclarator(uid, t.callExpression(this.file.addHelper("interop-require-default"), [ref]))]));

          this.remaps.add(scope, variableName.name, t.memberExpression(uid, t.identifier("default")));
        }
    } else {
      if (t.isImportNamespaceSpecifier(specifier)) {
        if (!this.noInteropRequireImport) {
          ref = t.callExpression(this.file.addHelper("interop-require-wildcard"), [ref]);
        }

        // import * as bar from "foo";
        nodes.push(t.variableDeclaration("var", [t.variableDeclarator(variableName, ref)]));
      } else {
        // import { foo } from "foo";
        this.remaps.add(scope, variableName.name, t.memberExpression(ref, t.identifier(specifier.imported.name)));
      }
    }
  };

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype.importDeclaration = function importDeclaration(node, nodes) {
    // import "foo";
    nodes.push(util.template("require", {
      MODULE_NAME: node.source
    }, true));
  };

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype.exportSpecifier = function exportSpecifier(specifier) {
    if (this.doDefaultExportInterop(specifier)) {
      this.hasDefaultOnlyExport = true;
    }

    _default2["default"].prototype.exportSpecifier.apply(this, arguments);
  };

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype.exportDeclaration = function exportDeclaration(node) {
    if (this.doDefaultExportInterop(node)) {
      this.hasDefaultOnlyExport = true;
    }

    _default2["default"].prototype.exportDeclaration.apply(this, arguments);
  };

  /**
   * [Please add a description.]
   */

  CommonJSFormatter.prototype._getExternalReference = function _getExternalReference(node, nodes) {
    var call = t.callExpression(t.identifier("require"), [node.source]);
    var uid;

    if (this.isModuleType(node, "absolute")) {
      // absolute module reference
    } else if (this.isModuleType(node, "absoluteDefault")) {
        call = t.memberExpression(call, t.identifier("default"));
      } else {
        uid = this.scope.generateUidIdentifierBasedOnNode(node, "import");
      }

    uid = uid || node.specifiers[0].local;

    var declar = t.variableDeclaration("var", [t.variableDeclarator(uid, call)]);
    nodes.push(declar);
    return uid;
  };

  return CommonJSFormatter;
})(_default2["default"]);

exports["default"] = CommonJSFormatter;
module.exports = exports["default"];