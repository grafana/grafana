/* */ 
"format cjs";
// Based upon the excellent jsx-transpiler by Ingvar Stepanyan (RReverser)
// https://github.com/RReverser/jsx-transpiler

// jsx

"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashLangIsString = require("lodash/lang/isString");

var _lodashLangIsString2 = _interopRequireDefault(_lodashLangIsString);

var _messages = require("../../messages");

var messages = _interopRequireWildcard(_messages);

var _esutils = require("esutils");

var _esutils2 = _interopRequireDefault(_esutils);

var _react = require("./react");

var react = _interopRequireWildcard(_react);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

exports["default"] = function (opts) {
  var visitor = {};

  /**
   * [Please add a description.]
   */

  visitor.JSXIdentifier = function (node) {
    if (node.name === "this" && this.isReferenced()) {
      return t.thisExpression();
    } else if (_esutils2["default"].keyword.isIdentifierNameES6(node.name)) {
      node.type = "Identifier";
    } else {
      return t.literal(node.name);
    }
  };

  /**
   * [Please add a description.]
   */

  visitor.JSXNamespacedName = function () {
    throw this.errorWithNode(messages.get("JSXNamespacedTags"));
  };

  /**
   * [Please add a description.]
   */

  visitor.JSXMemberExpression = {
    exit: function exit(node) {
      node.computed = t.isLiteral(node.property);
      node.type = "MemberExpression";
    }
  };

  /**
   * [Please add a description.]
   */

  visitor.JSXExpressionContainer = function (node) {
    return node.expression;
  };

  /**
   * [Please add a description.]
   */

  visitor.JSXAttribute = {
    enter: function enter(node) {
      var value = node.value;
      if (t.isLiteral(value) && _lodashLangIsString2["default"](value.value)) {
        value.value = value.value.replace(/\n\s+/g, " ");
      }
    },

    exit: function exit(node) {
      var value = node.value || t.literal(true);
      return t.inherits(t.property("init", node.name, value), node);
    }
  };

  /**
   * [Please add a description.]
   */

  visitor.JSXOpeningElement = {
    exit: function exit(node, parent, scope, file) {
      parent.children = react.buildChildren(parent);

      var tagExpr = node.name;
      var args = [];

      var tagName;
      if (t.isIdentifier(tagExpr)) {
        tagName = tagExpr.name;
      } else if (t.isLiteral(tagExpr)) {
        tagName = tagExpr.value;
      }

      var state = {
        tagExpr: tagExpr,
        tagName: tagName,
        args: args
      };

      if (opts.pre) {
        opts.pre(state, file);
      }

      var attribs = node.attributes;
      if (attribs.length) {
        attribs = buildJSXOpeningElementAttributes(attribs, file);
      } else {
        attribs = t.literal(null);
      }

      args.push(attribs);

      if (opts.post) {
        opts.post(state, file);
      }

      return state.call || t.callExpression(state.callee, args);
    }
  };

  /**
   * The logic for this is quite terse. It's because we need to
   * support spread elements. We loop over all attributes,
   * breaking on spreads, we then push a new object containg
   * all prior attributes to an array for later processing.
   */

  var buildJSXOpeningElementAttributes = function buildJSXOpeningElementAttributes(attribs, file) {
    var _props = [];
    var objs = [];

    var pushProps = function pushProps() {
      if (!_props.length) return;

      objs.push(t.objectExpression(_props));
      _props = [];
    };

    while (attribs.length) {
      var prop = attribs.shift();
      if (t.isJSXSpreadAttribute(prop)) {
        pushProps();
        objs.push(prop.argument);
      } else {
        _props.push(prop);
      }
    }

    pushProps();

    if (objs.length === 1) {
      // only one object
      attribs = objs[0];
    } else {
      // looks like we have multiple objects
      if (!t.isObjectExpression(objs[0])) {
        objs.unshift(t.objectExpression([]));
      }

      // spread it
      attribs = t.callExpression(file.addHelper("extends"), objs);
    }

    return attribs;
  };

  /**
   * [Please add a description.]
   */

  visitor.JSXElement = {
    exit: function exit(node) {
      var callExpr = node.openingElement;

      callExpr.arguments = callExpr.arguments.concat(node.children);

      if (callExpr.arguments.length >= 3) {
        callExpr._prettyCall = true;
      }

      return t.inherits(callExpr, node);
    }
  };

  return visitor;
};

module.exports = exports["default"];