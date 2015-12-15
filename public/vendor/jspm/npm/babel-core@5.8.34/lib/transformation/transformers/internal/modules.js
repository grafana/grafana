/* */ 
"format cjs";
// in this transformer we have to split up classes and function declarations
// from their exports. why? because sometimes we need to replace classes with
// nodes that aren't allowed in the same contexts. also, if you're exporting
// a generator function as a default then regenerator will destroy the export
// declaration and leave a variable declaration in it's place... yeah, handy.

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function getDeclar(node) {
  var declar = node.declaration;
  t.inheritsComments(declar, node);
  t.removeComments(node);
  declar._ignoreUserWhitespace = true;
  return declar;
}

/**
 * [Please add a description.]
 */

function buildExportSpecifier(id) {
  return t.exportSpecifier(cloneIdentifier(id), cloneIdentifier(id));
}

function cloneIdentifier(_ref) {
  var name = _ref.name;
  var loc = _ref.loc;

  var id = t.identifier(name);
  id._loc = loc;
  return id;
}

var metadata = {
  group: "builtin-pre"
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  ExportDefaultDeclaration: function ExportDefaultDeclaration(node, parent, scope) {
    var declar = node.declaration;

    if (t.isClassDeclaration(declar)) {
      // export default class Foo {};
      var nodes = [getDeclar(node), node];
      node.declaration = declar.id;
      return nodes;
    } else if (t.isClassExpression(declar)) {
      // export default class {};
      var temp = scope.generateUidIdentifier("default");
      node.declaration = t.variableDeclaration("var", [t.variableDeclarator(temp, declar)]);

      var nodes = [getDeclar(node), node];
      node.declaration = temp;
      return nodes;
    } else if (t.isFunctionDeclaration(declar)) {
      // export default function Foo() {}
      node._blockHoist = 2;

      var nodes = [getDeclar(node), node];
      node.declaration = declar.id;
      return nodes;
    }
  },

  /**
   * [Please add a description.]
   */

  ExportNamedDeclaration: function ExportNamedDeclaration(node) {
    var declar = node.declaration;

    if (t.isClassDeclaration(declar)) {
      // export class Foo {}
      node.specifiers = [buildExportSpecifier(declar.id)];

      var nodes = [getDeclar(node), node];
      node.declaration = null;
      return nodes;
    } else if (t.isFunctionDeclaration(declar)) {
      // export function Foo() {}
      var newExport = t.exportNamedDeclaration(null, [buildExportSpecifier(declar.id)]);
      newExport._blockHoist = 2;
      return [getDeclar(node), newExport];
    } else if (t.isVariableDeclaration(declar)) {
      // export var foo = "bar";
      var specifiers = [];
      var bindings = this.get("declaration").getBindingIdentifiers();
      for (var key in bindings) {
        specifiers.push(buildExportSpecifier(bindings[key]));
      }
      return [declar, t.exportNamedDeclaration(null, specifiers)];
    }
  },

  /**
   * [Please add a description.]
   */

  Program: {
    enter: function enter(node) {
      var imports = [];
      var rest = [];

      for (var i = 0; i < node.body.length; i++) {
        var bodyNode = node.body[i];
        if (t.isImportDeclaration(bodyNode)) {
          imports.push(bodyNode);
        } else {
          rest.push(bodyNode);
        }
      }

      node.body = imports.concat(rest);
    },

    exit: function exit(node, parent, scope, file) {
      if (!file.transformers["es6.modules"].canTransform()) return;

      if (file.moduleFormatter.setup) {
        file.moduleFormatter.setup();
      }
    }
  }
};
exports.visitor = visitor;