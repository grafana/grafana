/* */ 
var toIObject = require('./$.to-iobject'),
    toLength = require('./$.to-length'),
    toIndex = require('./$.to-index');
module.exports = function(IS_INCLUDES) {
  return function($this, el, fromIndex) {
    var O = toIObject($this),
        length = toLength(O.length),
        index = toIndex(fromIndex, length),
        value;
    if (IS_INCLUDES && el != el)
      while (length > index) {
        value = O[index++];
        if (value != value)
          return true;
      }
    else
      for (; length > index; index++)
        if (IS_INCLUDES || index in O) {
          if (O[index] === el)
            return IS_INCLUDES || index;
        }
    return !IS_INCLUDES && -1;
  };
};
