/* */ 
var $ = require('./$'),
    $export = require('./$.export'),
    aFunction = require('./$.a-function'),
    anObject = require('./$.an-object'),
    isObject = require('./$.is-object'),
    bind = Function.bind || require('./$.core').Function.prototype.bind;
$export($export.S + $export.F * require('./$.fails')(function() {
  function F() {}
  return !(Reflect.construct(function() {}, [], F) instanceof F);
}), 'Reflect', {construct: function construct(Target, args) {
    aFunction(Target);
    var newTarget = arguments.length < 3 ? Target : aFunction(arguments[2]);
    if (Target == newTarget) {
      if (args != undefined)
        switch (anObject(args).length) {
          case 0:
            return new Target;
          case 1:
            return new Target(args[0]);
          case 2:
            return new Target(args[0], args[1]);
          case 3:
            return new Target(args[0], args[1], args[2]);
          case 4:
            return new Target(args[0], args[1], args[2], args[3]);
        }
      var $args = [null];
      $args.push.apply($args, args);
      return new (bind.apply(Target, $args));
    }
    var proto = newTarget.prototype,
        instance = $.create(isObject(proto) ? proto : Object.prototype),
        result = Function.apply.call(Target, instance, args);
    return isObject(result) ? result : instance;
  }});
