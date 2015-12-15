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

var _amd = require("./amd");

var _amd2 = _interopRequireDefault(_amd);

var _util = require("../../util");

var util = _interopRequireWildcard(_util);

var _lodashArrayLast = require("lodash/array/last");

var _lodashArrayLast2 = _interopRequireDefault(_lodashArrayLast);

var _lodashCollectionMap = require("lodash/collection/map");

var _lodashCollectionMap2 = _interopRequireDefault(_lodashCollectionMap);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var hoistVariablesVisitor = {

  /**
   * [Please add a description.]
   */

  Function: function Function() {
    // nothing inside is accessible
    this.skip();
  },

  /**
   * [Please add a description.]
   */

  VariableDeclaration: function VariableDeclaration(node, parent, scope, state) {
    if (node.kind !== "var" && !t.isProgram(parent)) {
      // let, const
      // can't be accessed
      return;
    }

    // ignore block hoisted nodes as these can be left in
    if (state.formatter._canHoist(node)) return;

    var nodes = [];

    for (var i = 0; i < node.declarations.length; i++) {
      var declar = node.declarations[i];
      state.hoistDeclarators.push(t.variableDeclarator(declar.id));
      if (declar.init) {
        // no initializer so we can just hoist it as-is
        var assign = t.expressionStatement(t.assignmentExpression("=", declar.id, declar.init));
        nodes.push(assign);
      }
    }

    // for (var i in test)
    if (t.isFor(parent) && parent.left === node) {
      return node.declarations[0].id;
    }

    return nodes;
  }
};

/**
 * [Please add a description.]
 */

var hoistFunctionsVisitor = {

  /**
   * [Please add a description.]
   */

  Function: function Function() {
    this.skip();
  },

  /**
   * [Please add a description.]
   */

  enter: function enter(node, parent, scope, state) {
    if (t.isFunctionDeclaration(node) || state.formatter._canHoist(node)) {
      state.handlerBody.push(node);
      this.dangerouslyRemove();
    }
  }
};

/**
 * [Please add a description.]
 */

var runnerSettersVisitor = {

  /**
   * [Please add a description.]
   */

  enter: function enter(node, parent, scope, state) {
    if (node._importSource === state.source) {
      if (t.isVariableDeclaration(node)) {
        var _arr = node.declarations;

        for (var _i = 0; _i < _arr.length; _i++) {
          var declar = _arr[_i];
          state.hoistDeclarators.push(t.variableDeclarator(declar.id));
          state.nodes.push(t.expressionStatement(t.assignmentExpression("=", declar.id, declar.init)));
        }
      } else {
        state.nodes.push(node);
      }

      this.dangerouslyRemove();
    }
  }
};

/**
 * [Please add a description.]
 */

var SystemFormatter = (function (_AMDFormatter) {
  _inherits(SystemFormatter, _AMDFormatter);

  function SystemFormatter(file) {
    _classCallCheck(this, SystemFormatter);

    _AMDFormatter.call(this, file);

    this._setters = null;
    this.exportIdentifier = file.scope.generateUidIdentifier("export");
    this.noInteropRequireExport = true;
    this.noInteropRequireImport = true;

    this.remaps.clearAll();
  }

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype._addImportSource = function _addImportSource(node, exportNode) {
    if (node) node._importSource = exportNode.source && exportNode.source.value;
    return node;
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype.buildExportsWildcard = function buildExportsWildcard(objectIdentifier, node) {
    var leftIdentifier = this.scope.generateUidIdentifier("key");
    var valIdentifier = t.memberExpression(objectIdentifier, leftIdentifier, true);

    var left = t.variableDeclaration("var", [t.variableDeclarator(leftIdentifier)]);

    var right = objectIdentifier;

    var block = t.blockStatement([t.ifStatement(t.binaryExpression("!==", leftIdentifier, t.literal("default")), t.expressionStatement(this._buildExportCall(leftIdentifier, valIdentifier)))]);

    return this._addImportSource(t.forInStatement(left, right, block), node);
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype.buildExportsAssignment = function buildExportsAssignment(id, init, node) {
    var call = this._buildExportCall(t.literal(id.name), init, true);
    return this._addImportSource(call, node);
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype.buildExportsFromAssignment = function buildExportsFromAssignment() {
    return this.buildExportsAssignment.apply(this, arguments);
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype.remapExportAssignment = function remapExportAssignment(node, exported) {
    var assign = node;

    for (var i = 0; i < exported.length; i++) {
      assign = this._buildExportCall(t.literal(exported[i].name), assign);
    }

    return assign;
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype._buildExportCall = function _buildExportCall(id, init, isStatement) {
    var call = t.callExpression(this.exportIdentifier, [id, init]);
    if (isStatement) {
      return t.expressionStatement(call);
    } else {
      return call;
    }
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype.importSpecifier = function importSpecifier(specifier, node, nodes) {
    _amd2["default"].prototype.importSpecifier.apply(this, arguments);

    var _arr2 = this.remaps.getAll();

    for (var _i2 = 0; _i2 < _arr2.length; _i2++) {
      var remap = _arr2[_i2];
      nodes.push(t.variableDeclaration("var", [t.variableDeclarator(t.identifier(remap.name), remap.node)]));
    }

    this.remaps.clearAll();

    this._addImportSource(_lodashArrayLast2["default"](nodes), node);
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype._buildRunnerSetters = function _buildRunnerSetters(block, hoistDeclarators) {
    var scope = this.file.scope;

    return t.arrayExpression(_lodashCollectionMap2["default"](this.ids, function (uid, source) {
      var state = {
        hoistDeclarators: hoistDeclarators,
        source: source,
        nodes: []
      };

      scope.traverse(block, runnerSettersVisitor, state);

      return t.functionExpression(null, [uid], t.blockStatement(state.nodes));
    }));
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype._canHoist = function _canHoist(node) {
    return node._blockHoist && !this.file.dynamicImports.length;
  };

  /**
   * [Please add a description.]
   */

  SystemFormatter.prototype.transform = function transform(program) {
    _default2["default"].prototype.transform.apply(this, arguments);

    var hoistDeclarators = [];
    var moduleName = this.getModuleName();
    var moduleNameLiteral = t.literal(moduleName);

    var block = t.blockStatement(program.body);

    var setterListNode = this._buildRunnerSetters(block, hoistDeclarators);
    this._setters = setterListNode;

    var runner = util.template("system", {
      MODULE_DEPENDENCIES: t.arrayExpression(this.buildDependencyLiterals()),
      EXPORT_IDENTIFIER: this.exportIdentifier,
      MODULE_NAME: moduleNameLiteral,
      SETTERS: setterListNode,
      EXECUTE: t.functionExpression(null, [], block)
    }, true);

    var handlerBody = runner.expression.arguments[2].body.body;
    if (!moduleName) runner.expression.arguments.shift();

    var returnStatement = handlerBody.pop();

    // hoist up all variable declarations
    this.file.scope.traverse(block, hoistVariablesVisitor, {
      formatter: this,
      hoistDeclarators: hoistDeclarators
    });

    if (hoistDeclarators.length) {
      var hoistDeclar = t.variableDeclaration("var", hoistDeclarators);
      hoistDeclar._blockHoist = true;
      handlerBody.unshift(hoistDeclar);
    }

    // hoist up function declarations for circular references
    this.file.scope.traverse(block, hoistFunctionsVisitor, {
      formatter: this,
      handlerBody: handlerBody
    });

    handlerBody.push(returnStatement);

    program.body = [runner];
  };

  return SystemFormatter;
})(_amd2["default"]);

exports["default"] = SystemFormatter;
module.exports = exports["default"];