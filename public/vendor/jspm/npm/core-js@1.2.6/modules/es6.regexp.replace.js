/* */ 
require('./$.fix-re-wks')('replace', 2, function(defined, REPLACE, $replace) {
  return function replace(searchValue, replaceValue) {
    'use strict';
    var O = defined(this),
        fn = searchValue == undefined ? undefined : searchValue[REPLACE];
    return fn !== undefined ? fn.call(searchValue, O, replaceValue) : $replace.call(String(O), searchValue, replaceValue);
  };
});
