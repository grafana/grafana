System.register(["./all-layers2.js", "./all-layers4.js"], function($__export) {
  "use strict";
  var c, p;
  return {
    setters: [
      function(m) {
        p = m.p;
      }, 
      function(m) {
        $__export('c', c = m.c);
      }
    ],
    execute: function() {
      p();
    }
  };
});
