/* */ 
var $ = require('./$'),
    $export = require('./$.export'),
    anObject = require('./$.an-object');
$export($export.S, 'Reflect', {getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, propertyKey) {
    return $.getDesc(anObject(target), propertyKey);
  }});
