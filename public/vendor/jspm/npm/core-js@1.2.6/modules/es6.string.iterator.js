/* */ 
'use strict';
var $at = require('./$.string-at')(true);
require('./$.iter-define')(String, 'String', function(iterated) {
  this._t = String(iterated);
  this._i = 0;
}, function() {
  var O = this._t,
      index = this._i,
      point;
  if (index >= O.length)
    return {
      value: undefined,
      done: true
    };
  point = $at(O, index);
  this._i += point.length;
  return {
    value: point,
    done: false
  };
});
