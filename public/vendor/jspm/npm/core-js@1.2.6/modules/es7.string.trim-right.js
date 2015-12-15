/* */ 
'use strict';
require('./$.string-trim')('trimRight', function($trim) {
  return function trimRight() {
    return $trim(this, 2);
  };
});
