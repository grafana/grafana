/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

var metadata = {
  group: "builtin-trailing"
};

exports.metadata = metadata;
var FLOW_DIRECTIVE = "@flow";

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Program: function Program(node, parent, scope, file) {
    var _arr = file.ast.comments;

    for (var _i = 0; _i < _arr.length; _i++) {
      var comment = _arr[_i];
      if (comment.value.indexOf(FLOW_DIRECTIVE) >= 0) {
        // remove flow directive
        comment.value = comment.value.replace(FLOW_DIRECTIVE, "");

        // remove the comment completely if it only consists of whitespace and/or stars
        if (!comment.value.replace(/\*/g, "").trim()) comment._displayed = true;
      }
    }
  },

  /**
   * [Please add a description.]
   */

  Flow: function Flow() {
    this.dangerouslyRemove();
  },

  /**
   * [Please add a description.]
   */

  ClassProperty: function ClassProperty(node) {
    node.typeAnnotation = null;
    if (!node.value) this.dangerouslyRemove();
  },

  /**
   * [Please add a description.]
   */

  Class: function Class(node) {
    node["implements"] = null;
  },

  /**
   * [Please add a description.]
   */

  Function: function Function(node) {
    for (var i = 0; i < node.params.length; i++) {
      var param = node.params[i];
      param.optional = false;
    }
  },

  /**
   * [Please add a description.]
   */

  TypeCastExpression: function TypeCastExpression(node) {
    do {
      node = node.expression;
    } while (t.isTypeCastExpression(node));
    return node;
  }
};
exports.visitor = visitor;