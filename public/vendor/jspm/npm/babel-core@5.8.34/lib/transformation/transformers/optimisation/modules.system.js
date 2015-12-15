/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  optional: true,
  group: "builtin-trailing"
};

exports.metadata = metadata;
var visitor = {
  Program: function Program(node, parent, scope, file) {
    if (file.moduleFormatter._setters) {
      scope.traverse(file.moduleFormatter._setters, optimizeSettersVisitor, {
        exportFunctionIdentifier: file.moduleFormatter.exportIdentifier
      });
    }
  }
};

exports.visitor = visitor;
/**
 * Setters are optimized to avoid slow export behavior in modules that rely on deep hierarchies
 * of export-from declarations.
 * More info in https://github.com/babel/babel/pull/1722 and
 * https://github.com/ModuleLoader/es6-module-loader/issues/386.
 *
 * TODO: Ideally this would be optimized during construction of the setters, but the current
 * architecture of the module formatters make that difficult.
 */
var optimizeSettersVisitor = {
  FunctionExpression: {
    enter: function enter(node, parent, scope, state) {
      state.hasExports = false;
      state.exportObjectIdentifier = scope.generateUidIdentifier("exportObj");
    },
    exit: function exit(node, parent, scope, state) {
      if (!state.hasExports) return;

      node.body.body.unshift(t.variableDeclaration("var", [t.variableDeclarator(t.cloneDeep(state.exportObjectIdentifier), t.objectExpression([]))]));
      node.body.body.push(t.expressionStatement(t.callExpression(t.cloneDeep(state.exportFunctionIdentifier), [t.cloneDeep(state.exportObjectIdentifier)])));
    }
  },
  CallExpression: function CallExpression(node, parent, scope, state) {
    if (!t.isIdentifier(node.callee, { name: state.exportFunctionIdentifier.name })) return;

    state.hasExports = true;
    var memberNode = t.memberExpression(t.cloneDeep(state.exportObjectIdentifier), node.arguments[0], true);
    return t.assignmentExpression("=", memberNode, node.arguments[1]);
  }
};