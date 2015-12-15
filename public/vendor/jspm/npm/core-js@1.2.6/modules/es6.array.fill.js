/* */ 
var $export = require('./$.export');
$export($export.P, 'Array', {fill: require('./$.array-fill')});
require('./$.add-to-unscopables')('fill');
