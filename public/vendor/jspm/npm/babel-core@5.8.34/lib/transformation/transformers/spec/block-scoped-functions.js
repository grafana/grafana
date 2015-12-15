/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function statementList(key, path) {
  var paths = path.get(key);

  for (var i = 0; i < paths.length; i++) {
    var _path = paths[i];

    var func = _path.node;
    if (!t.isFunctionDeclaration(func)) continue;

    var declar = t.variableDeclaration("let", [t.variableDeclarator(func.id, t.toExpression(func))]);

    // hoist it up above everything else
    declar._blockHoist = 2;

    // todo: name this
    func.id = null;

    _path.replaceWith(declar);
  }
}

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  BlockStatement: function BlockStatement(node, parent) {
    if (t.isFunction(parent) && parent.body === node || t.isExportDeclaration(parent)) {
      return;
    }

    statementList("body", this);
  },

  /**
   * [Please add a description.]
   */

  SwitchCase: function SwitchCase() {
    statementList("consequent", this);
  }
};
exports.visitor = visitor;