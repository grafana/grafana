/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _helpersCallDelegate = require("../../../helpers/call-delegate");

var _helpersCallDelegate2 = _interopRequireDefault(_helpersCallDelegate);

var _helpersGetFunctionArity = require("../../../helpers/get-function-arity");

var _helpersGetFunctionArity2 = _interopRequireDefault(_helpersGetFunctionArity);

var _util = require("../../../../util");

var util = _interopRequireWildcard(_util);

var _types = require("../../../../types");

var t = _interopRequireWildcard(_types);

/**
 * [Please add a description.]
 */

var hasDefaults = function hasDefaults(node) {
  for (var i = 0; i < node.params.length; i++) {
    if (!t.isIdentifier(node.params[i])) return true;
  }
  return false;
};

/**
 * [Please add a description.]
 */

var iifeVisitor = {

  /**
   * [Please add a description.]
   */

  ReferencedIdentifier: function ReferencedIdentifier(node, parent, scope, state) {
    if (node.name !== "eval") {
      if (!state.scope.hasOwnBinding(node.name)) return;
      if (state.scope.bindingIdentifierEquals(node.name, node)) return;
    }

    state.iife = true;
    this.stop();
  }
};

/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Function: function Function(node, parent, scope, file) {
    if (!hasDefaults(node)) return;

    // ensure it's a block, useful for arrow functions
    this.ensureBlock();

    var state = {
      iife: false,
      scope: scope
    };

    var body = [];

    //
    var argsIdentifier = t.identifier("arguments");
    argsIdentifier._shadowedFunctionLiteral = this;

    // push a default parameter definition
    function pushDefNode(left, right, i) {
      var defNode;
      if (exceedsLastNonDefault(i) || t.isPattern(left) || file.transformers["es6.spec.blockScoping"].canTransform()) {
        defNode = util.template("default-parameter", {
          VARIABLE_NAME: left,
          DEFAULT_VALUE: right,
          ARGUMENT_KEY: t.literal(i),
          ARGUMENTS: argsIdentifier
        }, true);
      } else {
        defNode = util.template("default-parameter-assign", {
          VARIABLE_NAME: left,
          DEFAULT_VALUE: right
        }, true);
      }
      defNode._blockHoist = node.params.length - i;
      body.push(defNode);
    }

    // check if an index exceeds the functions arity
    function exceedsLastNonDefault(i) {
      return i + 1 > lastNonDefaultParam;
    }

    //
    var lastNonDefaultParam = _helpersGetFunctionArity2["default"](node);

    //
    var params = this.get("params");
    for (var i = 0; i < params.length; i++) {
      var param = params[i];

      if (!param.isAssignmentPattern()) {
        if (!param.isIdentifier()) {
          param.traverse(iifeVisitor, state);
        }

        if (file.transformers["es6.spec.blockScoping"].canTransform() && param.isIdentifier()) {
          pushDefNode(param.node, t.identifier("undefined"), i);
        }

        continue;
      }

      var left = param.get("left");
      var right = param.get("right");

      if (exceedsLastNonDefault(i) || left.isPattern()) {
        var placeholder = scope.generateUidIdentifier("x");
        placeholder._isDefaultPlaceholder = true;
        node.params[i] = placeholder;
      } else {
        node.params[i] = left.node;
      }

      if (!state.iife) {
        if (right.isIdentifier() && scope.hasOwnBinding(right.node.name)) {
          state.iife = true;
        } else {
          right.traverse(iifeVisitor, state);
        }
      }

      pushDefNode(left.node, right.node, i);
    }

    // we need to cut off all trailing default parameters
    node.params = node.params.slice(0, lastNonDefaultParam);

    if (state.iife) {
      body.push(_helpersCallDelegate2["default"](node, scope));
      node.body = t.blockStatement(body);
    } else {
      node.body.body = body.concat(node.body.body);
    }
  }
};
exports.visitor = visitor;