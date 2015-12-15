/* */ 
'use strict';
var $export = require('./$.export'),
    anObject = require('./$.an-object');
var Enumerate = function(iterated) {
  this._t = anObject(iterated);
  this._i = 0;
  var keys = this._k = [],
      key;
  for (key in iterated)
    keys.push(key);
};
require('./$.iter-create')(Enumerate, 'Object', function() {
  var that = this,
      keys = that._k,
      key;
  do {
    if (that._i >= keys.length)
      return {
        value: undefined,
        done: true
      };
  } while (!((key = keys[that._i++]) in that._t));
  return {
    value: key,
    done: false
  };
});
$export($export.S, 'Reflect', {enumerate: function enumerate(target) {
    return new Enumerate(target);
  }});
