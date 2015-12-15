/* */ 
var $export = require('./$.export'),
    exp = Math.exp;
$export($export.S, 'Math', {cosh: function cosh(x) {
    return (exp(x = +x) + exp(-x)) / 2;
  }});
