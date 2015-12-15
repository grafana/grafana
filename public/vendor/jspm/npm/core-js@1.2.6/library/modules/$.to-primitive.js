/* */ 
var isObject = require('./$.is-object');
module.exports = function(it, S) {
  if (!isObject(it))
    return it;
  var fn,
      val;
  if (S && typeof(fn = it.toString) == 'function' && !isObject(val = fn.call(it)))
    return val;
  if (typeof(fn = it.valueOf) == 'function' && !isObject(val = fn.call(it)))
    return val;
  if (!S && typeof(fn = it.toString) == 'function' && !isObject(val = fn.call(it)))
    return val;
  throw TypeError("Can't convert object to primitive value");
};
