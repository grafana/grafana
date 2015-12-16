System.register(["./register-circular2.js"], function($__export) {
  "use strict";
  var c,
      q,
      r;
  function p() {
    if (q)
      $__export("r", r = c);
    else
      $__export("q", q = c);
  }
  $__export("p", p);
  return {
    setters: [function(m) {
      c = m.c;
    }],
    execute: function() {
      c = 5;
      q = $__export("q", q);
      r = $__export("r", r);
      p();
    }
  };
});