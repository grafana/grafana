System.register(["./all-layers3.js"], function($__export) {
  "use strict";
  var q, r, c;
  function p() {
    if (q)
      r = $__export('r', c);
    else
      q = $__export('q', c);
  }
  $__export('p', p);
  return {
    setters: [function(m) {
      c = m.c;
    }],
    execute: function() {
      c = 5;
      p();
    }
  };
});
