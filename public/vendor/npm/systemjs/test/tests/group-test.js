"format register";

System.register("group-c", [], function($__export) {
  "use strict";
  var __moduleName = "group-c";
  return {
    setters: [],
    execute: function() {
      $__export('default', 'bar');
    }
  };
});



System.registerDynamic("group-b", ["group-c"], false, function(__require, __exports, __module) {
  var _retrieveGlobal = System.get("@@global-helpers").prepareGlobal(__module.id);
  (function() {
    this.foo = 'foo';
  }).call(System.global);
  return _retrieveGlobal();
});

System.register("group-a", ["./group-b"], function($__export) {
  "use strict";
  var __moduleName = "group-a";
  return {
    setters: [function(m) {}],
    execute: function() {}
  };
});



