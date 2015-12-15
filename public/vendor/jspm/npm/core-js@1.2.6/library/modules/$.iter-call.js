/* */ 
var anObject = require('./$.an-object');
module.exports = function(iterator, fn, value, entries) {
  try {
    return entries ? fn(anObject(value)[0], value[1]) : fn(value);
  } catch (e) {
    var ret = iterator['return'];
    if (ret !== undefined)
      anObject(ret.call(iterator));
    throw e;
  }
};
