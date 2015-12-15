/* */ 
var $export = require('./$.export');
$export($export.S, 'Math', {log10: function log10(x) {
    return Math.log(x) / Math.LN10;
  }});
