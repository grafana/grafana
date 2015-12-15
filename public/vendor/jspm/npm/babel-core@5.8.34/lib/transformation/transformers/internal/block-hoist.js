/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _lodashCollectionSortBy = require("lodash/collection/sortBy");

var _lodashCollectionSortBy2 = _interopRequireDefault(_lodashCollectionSortBy);

var metadata = {
  group: "builtin-trailing"
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 *
 * Priority:
 *
 *  - 0 We want this to be at the **very** bottom
 *  - 1 Default node position
 *  - 2 Priority over normal nodes
 *  - 3 We want this to be at the **very** top
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Block: {
    exit: function exit(node) {
      var hasChange = false;
      for (var i = 0; i < node.body.length; i++) {
        var bodyNode = node.body[i];
        if (bodyNode && bodyNode._blockHoist != null) {
          hasChange = true;
          break;
        }
      }
      if (!hasChange) return;

      node.body = _lodashCollectionSortBy2["default"](node.body, function (bodyNode) {
        var priority = bodyNode && bodyNode._blockHoist;
        if (priority == null) priority = 1;
        if (priority === true) priority = 2;

        // Higher priorities should move toward the top.
        return -1 * priority;
      });
    }
  }
};
exports.visitor = visitor;