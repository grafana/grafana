/* */ 
require('./$.fix-re-wks')('split', 2, function(defined, SPLIT, $split) {
  return function split(separator, limit) {
    'use strict';
    var O = defined(this),
        fn = separator == undefined ? undefined : separator[SPLIT];
    return fn !== undefined ? fn.call(separator, O, limit) : $split.call(String(O), separator, limit);
  };
});
