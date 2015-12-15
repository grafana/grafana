/* */ 
var $export = require('./$.export');
$export($export.P, 'Array', {copyWithin: require('./$.array-copy-within')});
require('./$.add-to-unscopables')('copyWithin');
