/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.manipulateOptions = manipulateOptions;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _helpersReact = require("../../helpers/react");

var react = _interopRequireWildcard(_helpersReact);

var _types = require("../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

function manipulateOptions(opts) {
  opts.blacklist.push("react");
}

var metadata = {
  optional: true,
  group: "builtin-advanced"
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = require("../../helpers/build-react-transformer")({

  /**
   * [Please add a description.]
   */

  pre: function pre(state) {
    state.callee = state.tagExpr;
  },

  /**
   * [Please add a description.]
   */

  post: function post(state) {
    if (react.isCompatTag(state.tagName)) {
      state.call = t.callExpression(t.memberExpression(t.memberExpression(t.identifier("React"), t.identifier("DOM")), state.tagExpr, t.isLiteral(state.tagExpr)), state.args);
    }
  }
});
exports.visitor = visitor;