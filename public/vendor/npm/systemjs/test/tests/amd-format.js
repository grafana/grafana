/*
  this is AMD
*/
// works with comments!!!
/*
  At least I hope so
*/
"amd";

var m = {
  amd: 'amd'
};
define(m);

// attempt to fool amd detection
if (typeof module != 'undefined')
  module.exports = 'hello';

