/* */ 
"format cjs";
"use strict";

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashLangIsBoolean = require("lodash/lang/isBoolean");

var _lodashLangIsBoolean2 = _interopRequireDefault(_lodashLangIsBoolean);

var _lodashCollectionEach = require("lodash/collection/each");

var _lodashCollectionEach2 = _interopRequireDefault(_lodashCollectionEach);

var _lodashCollectionMap = require("lodash/collection/map");

var _lodashCollectionMap2 = _interopRequireDefault(_lodashCollectionMap);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Crawl a node to test if it contains a CallExpression, a Function, or a Helper.
 *
 * @example
 * crawl(node)
 * // { hasCall: false, hasFunction: true, hasHelper: false }
 */

function crawl(node) {
  var state = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  if (t.isMemberExpression(node)) {
    crawl(node.object, state);
    if (node.computed) crawl(node.property, state);
  } else if (t.isBinary(node) || t.isAssignmentExpression(node)) {
    crawl(node.left, state);
    crawl(node.right, state);
  } else if (t.isCallExpression(node)) {
    state.hasCall = true;
    crawl(node.callee, state);
  } else if (t.isFunction(node)) {
    state.hasFunction = true;
  } else if (t.isIdentifier(node)) {
    state.hasHelper = state.hasHelper || isHelper(node.callee);
  }

  return state;
}

/**
 * Test if a node is or has a helper.
 */

function isHelper(node) {
  if (t.isMemberExpression(node)) {
    return isHelper(node.object) || isHelper(node.property);
  } else if (t.isIdentifier(node)) {
    return node.name === "require" || node.name[0] === "_";
  } else if (t.isCallExpression(node)) {
    return isHelper(node.callee);
  } else if (t.isBinary(node) || t.isAssignmentExpression(node)) {
    return t.isIdentifier(node.left) && isHelper(node.left) || isHelper(node.right);
  } else {
    return false;
  }
}

/**
 * [Please add a description.]
 */

function isType(node) {
  return t.isLiteral(node) || t.isObjectExpression(node) || t.isArrayExpression(node) || t.isIdentifier(node) || t.isMemberExpression(node);
}

/**
 * Tests for node types that need whitespace.
 */

exports.nodes = {

  /**
   * Test if AssignmentExpression needs whitespace.
   */

  AssignmentExpression: function AssignmentExpression(node) {
    var state = crawl(node.right);
    if (state.hasCall && state.hasHelper || state.hasFunction) {
      return {
        before: state.hasFunction,
        after: true
      };
    }
  },

  /**
   * Test if SwitchCase needs whitespace.
   */

  SwitchCase: function SwitchCase(node, parent) {
    return {
      before: node.consequent.length || parent.cases[0] === node
    };
  },

  /**
   * Test if LogicalExpression needs whitespace.
   */

  LogicalExpression: function LogicalExpression(node) {
    if (t.isFunction(node.left) || t.isFunction(node.right)) {
      return {
        after: true
      };
    }
  },

  /**
   * Test if Literal needs whitespace.
   */

  Literal: function Literal(node) {
    if (node.value === "use strict") {
      return {
        after: true
      };
    }
  },

  /**
   * Test if CallExpression needs whitespace.
   */

  CallExpression: function CallExpression(node) {
    if (t.isFunction(node.callee) || isHelper(node)) {
      return {
        before: true,
        after: true
      };
    }
  },

  /**
   * Test if VariableDeclaration needs whitespace.
   */

  VariableDeclaration: function VariableDeclaration(node) {
    for (var i = 0; i < node.declarations.length; i++) {
      var declar = node.declarations[i];

      var enabled = isHelper(declar.id) && !isType(declar.init);
      if (!enabled) {
        var state = crawl(declar.init);
        enabled = isHelper(declar.init) && state.hasCall || state.hasFunction;
      }

      if (enabled) {
        return {
          before: true,
          after: true
        };
      }
    }
  },

  /**
   * Test if IfStatement needs whitespace.
   */

  IfStatement: function IfStatement(node) {
    if (t.isBlockStatement(node.consequent)) {
      return {
        before: true,
        after: true
      };
    }
  }
};

/**
 * Test if Property or SpreadProperty needs whitespace.
 */

exports.nodes.Property = exports.nodes.SpreadProperty = function (node, parent) {
  if (parent.properties[0] === node) {
    return {
      before: true
    };
  }
};

/**
 * Returns lists from node types that need whitespace.
 */

exports.list = {

  /**
   * Return VariableDeclaration declarations init properties.
   */

  VariableDeclaration: function VariableDeclaration(node) {
    return _lodashCollectionMap2["default"](node.declarations, "init");
  },

  /**
   * Return VariableDeclaration elements.
   */

  ArrayExpression: function ArrayExpression(node) {
    return node.elements;
  },

  /**
   * Return VariableDeclaration properties.
   */

  ObjectExpression: function ObjectExpression(node) {
    return node.properties;
  }
};

/**
 * Add whitespace tests for nodes and their aliases.
 */

_lodashCollectionEach2["default"]({
  Function: true,
  Class: true,
  Loop: true,
  LabeledStatement: true,
  SwitchStatement: true,
  TryStatement: true
}, function (amounts, type) {
  if (_lodashLangIsBoolean2["default"](amounts)) {
    amounts = { after: amounts, before: amounts };
  }

  _lodashCollectionEach2["default"]([type].concat(t.FLIPPED_ALIAS_KEYS[type] || []), function (type) {
    exports.nodes[type] = function () {
      return amounts;
    };
  });
});