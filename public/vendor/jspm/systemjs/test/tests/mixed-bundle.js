System.register("tree/third", [], function($__export) {
  var some;
  return {
    setters: [],
    execute: function() {
      some = $__export('some', 'exports');
    }
  };
});

System.registerDynamic("tree/cjs", [], true, function(require, exports, __moduleName) {
  var global = System.global;
  var __define = global.define;
  global.define = undefined;
  var module = { exports: exports };
  var process = System.get("@@nodeProcess");
  exports.cjs = true;
  global.define = __define;
  return module.exports;
});

System.registerDynamic("tree/jquery", [], false, function(require, exports, __moduleName) {
  var _retrieveGlobal = System.get("@@global-helpers").prepareGlobal(__moduleName);
  this.jquery = {};
  
  
  return _retrieveGlobal();
});

System.register("tree/second", ["./third", "./cjs"], function($__export) {
  "use strict";
  var __moduleName = "tree/second";
  var q;
  return {
    setters: [function() {}, function() {}],
    execute: function() {
      q = $__export('q', 4);
    }
  };
});

System.registerDynamic("tree/global", ['./jquery'], false, function(__require, __exports, __moduleName) {
  var _retrieveGlobal = System.get("@@global-helpers").prepareGlobal(__moduleName, "jquery.test");
  "deps ./jquery";
  "exports jquery.test";
  this.jquery = this.jquery || {};
  this.jquery.test = 'output';
  
  this["jquery.test"] = jquery.test;
  return _retrieveGlobal();
});

System.registerDynamic("tree/amd", ['./global'], false, function() {
  return { is: 'amd' };
});


System.register("tree/first", ["./second", "./amd"], function($__export) {
  "use strict";
  var __moduleName = "tree/first";
  var p;
  return {
    setters: [function() {}, function() {}],
    execute: function() {
      p = $__export('p', 5);
    }
  };
});
