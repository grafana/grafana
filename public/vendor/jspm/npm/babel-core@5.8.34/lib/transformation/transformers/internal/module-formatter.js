/* */ 
"format cjs";
"use strict";

exports.__esModule = true;
var metadata = {
  group: "builtin-modules"
};

exports.metadata = metadata;
/**
 * [Please add a description.]
 */

var visitor = {

  /**
   * [Please add a description.]
   */

  Program: {
    exit: function exit(program, parent, scope, file) {
      // ensure that these are at the top, just like normal imports
      var _arr = file.dynamicImports;
      for (var _i = 0; _i < _arr.length; _i++) {
        var node = _arr[_i];
        node._blockHoist = 3;
      }

      program.body = file.dynamicImports.concat(program.body);

      if (!file.transformers["es6.modules"].canTransform()) return;

      if (file.moduleFormatter.transform) {
        file.moduleFormatter.transform(program);
      }
    }
  }
};
exports.visitor = visitor;