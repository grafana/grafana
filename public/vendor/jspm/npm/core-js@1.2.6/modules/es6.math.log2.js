/* */ 
var $export = require('./$.export');
$export($export.S, 'Math', {log2: function log2(x) {
    return Math.log(x) / Math.LN2;
  }});
