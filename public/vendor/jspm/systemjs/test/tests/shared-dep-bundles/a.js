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



System.register("lib/a", ["./shared-dep"], function($__export) {
  "use strict";
  var __moduleName = "lib/a";
  var shared;
  return {
    setters: [function(m) {
      shared = m.default;
    }],
    execute: function() {
    }
  };
});



//# sourceMappingURL=a.js.map