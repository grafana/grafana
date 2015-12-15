/* */ 
'use strict';
require('./$.string-trim')('trim', function($trim) {
  return function trim() {
    return $trim(this, 3);
  };
});
