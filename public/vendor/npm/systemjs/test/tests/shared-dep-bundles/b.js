"format register";

System.register("lib/shared-dep", [], function($__export) {
  "use strict";
  var __moduleName = "lib/shared-dep";
  function shared() {}
  $__export("default", shared);
  return {
    setters: [],
    execute: function() {
      ;
    }
  };
});



System.register("lib/b", ["./shared-dep"], function($__export) {
  "use strict";
  var __moduleName = "lib/b";
  var shared;
  return {
    setters: [function(m) {
      shared = m.default;
    }],
    execute: function() {
    }
  };
});



//# sourceMappingURL=b.js.map