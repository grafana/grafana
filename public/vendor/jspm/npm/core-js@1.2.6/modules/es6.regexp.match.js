/* */ 
require('./$.fix-re-wks')('match', 1, function(defined, MATCH) {
  return function match(regexp) {
    'use strict';
    var O = defined(this),
        fn = regexp == undefined ? undefined : regexp[MATCH];
    return fn !== undefined ? fn.call(regexp, O) : new RegExp(regexp)[MATCH](String(O));
  };
});
