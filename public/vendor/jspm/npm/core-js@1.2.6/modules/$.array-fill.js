/* */ 
'use strict';
var toObject = require('./$.to-object'),
    toIndex = require('./$.to-index'),
    toLength = require('./$.to-length');
module.exports = [].fill || function fill(value) {
  var O = toObject(this),
      length = toLength(O.length),
      $$ = arguments,
      $$len = $$.length,
      index = toIndex($$len > 1 ? $$[1] : undefined, length),
      end = $$len > 2 ? $$[2] : undefined,
      endPos = end === undefined ? length : toIndex(end, length);
  while (endPos > index)
    O[index++] = value;
  return O;
};
