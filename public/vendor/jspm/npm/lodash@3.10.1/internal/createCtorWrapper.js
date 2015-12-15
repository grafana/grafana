/* */ 
var baseCreate = require('./baseCreate'),
    isObject = require('../lang/isObject');
function createCtorWrapper(Ctor) {
  return function() {
    var args = arguments;
    switch (args.length) {
      case 0:
        return new Ctor;
      case 1:
        return new Ctor(args[0]);
      case 2:
        return new Ctor(args[0], args[1]);
      case 3:
        return new Ctor(args[0], args[1], args[2]);
      case 4:
        return new Ctor(args[0], args[1], args[2], args[3]);
      case 5:
        return new Ctor(args[0], args[1], args[2], args[3], args[4]);
      case 6:
        return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 7:
        return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    }
    var thisBinding = baseCreate(Ctor.prototype),
        result = Ctor.apply(thisBinding, args);
    return isObject(result) ? result : thisBinding;
  };
}
module.exports = createCtorWrapper;
