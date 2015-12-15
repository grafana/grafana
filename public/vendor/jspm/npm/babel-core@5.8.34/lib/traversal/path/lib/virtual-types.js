/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _transformationHelpersReact = require("../../../transformation/helpers/react");

var react = _interopRequireWildcard(_transformationHelpersReact);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var ReferencedIdentifier = {
  types: ["Identifier", "JSXIdentifier"],
  checkPath: function checkPath(_ref, opts) {
    var node = _ref.node;
    var parent = _ref.parent;

    if (!t.isIdentifier(node, opts)) {
      if (t.isJSXIdentifier(node, opts)) {
        if (react.isCompatTag(node.name)) return false;
      } else {
        // not a JSXIdentifier or an Identifier
        return false;
      }
    }

    // check if node is referenced
    return t.isReferenced(node, parent);
  }
};

exports.ReferencedIdentifier = ReferencedIdentifier;
/**
 * [Please add a description.]
 */

var BindingIdentifier = {
  types: ["Identifier"],
  checkPath: function checkPath(_ref2) {
    var node = _ref2.node;
    var parent = _ref2.parent;

    return t.isBinding(node, parent);
  }
};

exports.BindingIdentifier = BindingIdentifier;
/**
 * [Please add a description.]
 */

var Statement = {
  types: ["Statement"],
  checkPath: function checkPath(_ref3) {
    var node = _ref3.node;
    var parent = _ref3.parent;

    if (t.isStatement(node)) {
      if (t.isVariableDeclaration(node)) {
        if (t.isForXStatement(parent, { left: node })) return false;
        if (t.isForStatement(parent, { init: node })) return false;
      }

      return true;
    } else {
      return false;
    }
  }
};

exports.Statement = Statement;
/**
 * [Please add a description.]
 */

var Expression = {
  types: ["Expression"],
  checkPath: function checkPath(path) {
    if (path.isIdentifier()) {
      return path.isReferencedIdentifier();
    } else {
      return t.isExpression(path.node);
    }
  }
};

exports.Expression = Expression;
/**
 * [Please add a description.]
 */

var Scope = {
  types: ["Scopable"],
  checkPath: function checkPath(path) {
    return t.isScope(path.node, path.parent);
  }
};

exports.Scope = Scope;
/**
 * [Please add a description.]
 */

var Referenced = {
  checkPath: function checkPath(path) {
    return t.isReferenced(path.node, path.parent);
  }
};

exports.Referenced = Referenced;
/**
 * [Please add a description.]
 */

var BlockScoped = {
  checkPath: function checkPath(path) {
    return t.isBlockScoped(path.node);
  }
};

exports.BlockScoped = BlockScoped;
/**
 * [Please add a description.]
 */

var Var = {
  types: ["VariableDeclaration"],
  checkPath: function checkPath(path) {
    return t.isVar(path.node);
  }
};

exports.Var = Var;
/**
 * [Please add a description.]
 */

var DirectiveLiteral = {
  types: ["Literal"],
  checkPath: function checkPath(path) {
    return path.isLiteral() && path.parentPath.isExpressionStatement();
  }
};

exports.DirectiveLiteral = DirectiveLiteral;
/**
 * [Please add a description.]
 */

var Directive = {
  types: ["ExpressionStatement"],
  checkPath: function checkPath(path) {
    return path.get("expression").isLiteral();
  }
};

exports.Directive = Directive;
/**
 * [Please add a description.]
 */

var User = {
  checkPath: function checkPath(path) {
    return path.node && !!path.node.loc;
  }
};

exports.User = User;
/**
 * [Please add a description.]
 */

var Generated = {
  checkPath: function checkPath(path) {
    return !path.isUser();
  }
};

exports.Generated = Generated;
/**
 * [Please add a description.]
 */

var Flow = {
  types: ["Flow", "ImportDeclaration", "ExportDeclaration"],
  checkPath: function checkPath(_ref4) {
    var node = _ref4.node;

    if (t.isFlow(node)) {
      return true;
    } else if (t.isImportDeclaration(node)) {
      return node.importKind === "type" || node.importKind === "typeof";
    } else if (t.isExportDeclaration(node)) {
      return node.exportKind === "type";
    } else {
      return false;
    }
  }
};
exports.Flow = Flow;