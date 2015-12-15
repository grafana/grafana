/* */ 
"format cjs";
"use strict";

exports.__esModule = true;

var _helpersNameMethod = require("../../helpers/name-method");

var metadata = {
  group: "builtin-basic"
};

exports.metadata = metadata;
// visit Property functions first - https://github.com/babel/babel/issues/1860

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  "ArrowFunctionExpression|FunctionExpression": {
    exit: function exit() {
      if (!this.parentPath.isProperty()) {
        return _helpersNameMethod.bare.apply(this, arguments);
      }
    }
  },

  /**
   * [Please add a description.]
   */

  ObjectExpression: function ObjectExpression() {
    var props = this.get("properties");
    var _arr = props;
    for (var _i = 0; _i < _arr.length; _i++) {
      var prop = _arr[_i];
      var value = prop.get("value");
      if (value.isFunction()) {
        var newNode = _helpersNameMethod.bare(value.node, prop.node, value.scope);
        if (newNode) value.replaceWith(newNode);
      }
    }
  }
};
exports.visitor = visitor;