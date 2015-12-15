/* */ 
var $export = require('./$.export'),
    _apply = Function.apply;
$export($export.S, 'Reflect', {apply: function apply(target, thisArgument, argumentsList) {
    return _apply.call(target, thisArgument, argumentsList);
  }});
