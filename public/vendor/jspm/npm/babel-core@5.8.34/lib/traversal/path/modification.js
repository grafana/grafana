/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
exports.insertBefore = insertBefore;
exports._containerInsert = _containerInsert;
exports._containerInsertBefore = _containerInsertBefore;
exports._containerInsertAfter = _containerInsertAfter;
exports._maybePopFromStatements = _maybePopFromStatements;
exports.insertAfter = insertAfter;
exports.updateSiblingKeys = updateSiblingKeys;
exports._verifyNodeList = _verifyNodeList;
exports.unshiftContainer = unshiftContainer;
exports.pushContainer = pushContainer;
exports.hoist = hoist;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _libHoister = require("./lib/hoister");

var _libHoister2 = _interopRequireDefault(_libHoister);

var _index = require("./index");

var _index2 = _interopRequireDefault(_index);

var _types = require("../../types");

var t = _interopRequireWildcard(_types);

/**
 * Insert the provided nodes before the current one.
 */

function insertBefore(nodes) {
  this._assertUnremoved();

  nodes = this._verifyNodeList(nodes);

  if (this.parentPath.isExpressionStatement() || this.parentPath.isLabeledStatement()) {
    return this.parentPath.insertBefore(nodes);
  } else if (this.isNodeType("Expression") || this.parentPath.isForStatement() && this.key === "init") {
    if (this.node) nodes.push(this.node);
    this.replaceExpressionWithStatements(nodes);
  } else {
    this._maybePopFromStatements(nodes);
    if (Array.isArray(this.container)) {
      return this._containerInsertBefore(nodes);
    } else if (this.isStatementOrBlock()) {
      if (this.node) nodes.push(this.node);
      this.node = this.container[this.key] = t.blockStatement(nodes);
    } else {
      throw new Error("We don't know what to do with this node type. We were previously a Statement but we can't fit in here?");
    }
  }

  return [this];
}

/**
 * [Please add a description.]
 */

function _containerInsert(from, nodes) {
  this.updateSiblingKeys(from, nodes.length);

  var paths = [];

  for (var i = 0; i < nodes.length; i++) {
    var to = from + i;
    var node = nodes[i];
    this.container.splice(to, 0, node);

    if (this.context) {
      var path = this.context.create(this.parent, this.container, to, this.listKey);
      paths.push(path);
      this.queueNode(path);
    } else {
      paths.push(_index2["default"].get({
        parentPath: this,
        parent: node,
        container: this.container,
        listKey: this.listKey,
        key: to
      }));
    }
  }

  return paths;
}

/**
 * [Please add a description.]
 */

function _containerInsertBefore(nodes) {
  return this._containerInsert(this.key, nodes);
}

/**
 * [Please add a description.]
 */

function _containerInsertAfter(nodes) {
  return this._containerInsert(this.key + 1, nodes);
}

/**
 * [Please add a description.]
 */

function _maybePopFromStatements(nodes) {
  var last = nodes[nodes.length - 1];
  if (t.isExpressionStatement(last) && t.isIdentifier(last.expression) && !this.isCompletionRecord()) {
    nodes.pop();
  }
}

/**
 * Insert the provided nodes after the current one. When inserting nodes after an
 * expression, ensure that the completion record is correct by pushing the current node.
 */

function insertAfter(nodes) {
  this._assertUnremoved();

  nodes = this._verifyNodeList(nodes);

  if (this.parentPath.isExpressionStatement() || this.parentPath.isLabeledStatement()) {
    return this.parentPath.insertAfter(nodes);
  } else if (this.isNodeType("Expression") || this.parentPath.isForStatement() && this.key === "init") {
    if (this.node) {
      var temp = this.scope.generateDeclaredUidIdentifier();
      nodes.unshift(t.expressionStatement(t.assignmentExpression("=", temp, this.node)));
      nodes.push(t.expressionStatement(temp));
    }
    this.replaceExpressionWithStatements(nodes);
  } else {
    this._maybePopFromStatements(nodes);
    if (Array.isArray(this.container)) {
      return this._containerInsertAfter(nodes);
    } else if (this.isStatementOrBlock()) {
      if (this.node) nodes.unshift(this.node);
      this.node = this.container[this.key] = t.blockStatement(nodes);
    } else {
      throw new Error("We don't know what to do with this node type. We were previously a Statement but we can't fit in here?");
    }
  }

  return [this];
}

/**
 * Update all sibling node paths after `fromIndex` by `incrementBy`.
 */

function updateSiblingKeys(fromIndex, incrementBy) {
  var paths = this.parent._paths;
  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
    if (path.key >= fromIndex) {
      path.key += incrementBy;
    }
  }
}

/**
 * [Please add a description.]
 */

function _verifyNodeList(nodes) {
  if (nodes.constructor !== Array) {
    nodes = [nodes];
  }

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (!node) {
      throw new Error("Node list has falsy node with the index of " + i);
    } else if (typeof node !== "object") {
      throw new Error("Node list contains a non-object node with the index of " + i);
    } else if (!node.type) {
      throw new Error("Node list contains a node without a type with the index of " + i);
    } else if (node instanceof _index2["default"]) {
      nodes[i] = node.node;
    }
  }

  return nodes;
}

/**
 * [Please add a description.]
 */

function unshiftContainer(listKey, nodes) {
  this._assertUnremoved();

  nodes = this._verifyNodeList(nodes);

  // get the first path and insert our nodes before it, if it doesn't exist then it
  // doesn't matter, our nodes will be inserted anyway

  var container = this.node[listKey];
  var path = _index2["default"].get({
    parentPath: this,
    parent: this.node,
    container: container,
    listKey: listKey,
    key: 0
  });

  return path.insertBefore(nodes);
}

/**
 * [Please add a description.]
 */

function pushContainer(listKey, nodes) {
  this._assertUnremoved();

  nodes = this._verifyNodeList(nodes);

  // get an invisible path that represents the last node + 1 and replace it with our
  // nodes, effectively inlining it

  var container = this.node[listKey];
  var i = container.length;
  var path = _index2["default"].get({
    parentPath: this,
    parent: this.node,
    container: container,
    listKey: listKey,
    key: i
  });

  return path.replaceWith(nodes, true);
}

/**
 * Hoist the current node to the highest scope possible and return a UID
 * referencing it.
 */

function hoist() {
  var scope = arguments.length <= 0 || arguments[0] === undefined ? this.scope : arguments[0];

  var hoister = new _libHoister2["default"](this, scope);
  return hoister.run();
}