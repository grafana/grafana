define([
  // with a single-line comment
  './amd-module.js',
  /* with a multi-line
     comment
   */
  './amd-module.js'
  // trailing single-line comment
  /* trailing multi-line
     comment */
], function () {
  return { amd: true };
});
