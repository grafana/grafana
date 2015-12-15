/* */ 
'use strict';
var $export = require('./$.export'),
    $at = require('./$.string-at')(false);
$export($export.P, 'String', {codePointAt: function codePointAt(pos) {
    return $at(this, pos);
  }});
