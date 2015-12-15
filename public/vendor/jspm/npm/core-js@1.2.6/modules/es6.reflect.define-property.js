/* */ 
var $ = require('./$'),
    $export = require('./$.export'),
    anObject = require('./$.an-object');
$export($export.S + $export.F * require('./$.fails')(function() {
  Reflect.defineProperty($.setDesc({}, 1, {value: 1}), 1, {value: 2});
}), 'Reflect', {defineProperty: function defineProperty(target, propertyKey, attributes) {
    anObject(target);
    try {
      $.setDesc(target, propertyKey, attributes);
      return true;
    } catch (e) {
      return false;
    }
  }});
