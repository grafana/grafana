/* */ 
'use strict';
require('./$.string-trim')('trimLeft', function($trim) {
  return function trimLeft() {
    return $trim(this, 1);
  };
});
