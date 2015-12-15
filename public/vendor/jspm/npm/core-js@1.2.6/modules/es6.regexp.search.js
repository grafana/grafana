/* */ 
require('./$.fix-re-wks')('search', 1, function(defined, SEARCH) {
  return function search(regexp) {
    'use strict';
    var O = defined(this),
        fn = regexp == undefined ? undefined : regexp[SEARCH];
    return fn !== undefined ? fn.call(regexp, O) : new RegExp(regexp)[SEARCH](String(O));
  };
});
