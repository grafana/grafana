/* */ 
'use strict';
var $export = require('./$.export'),
    $includes = require('./$.array-includes')(true);
$export($export.P, 'Array', {includes: function includes(el) {
    return $includes(this, el, arguments.length > 1 ? arguments[1] : undefined);
  }});
require('./$.add-to-unscopables')('includes');
