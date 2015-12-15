/* */ 
var $ = require('./$'),
    toObject = require('./$.to-object'),
    IObject = require('./$.iobject');
module.exports = require('./$.fails')(function() {
  var a = Object.assign,
      A = {},
      B = {},
      S = Symbol(),
      K = 'abcdefghijklmnopqrst';
  A[S] = 7;
  K.split('').forEach(function(k) {
    B[k] = k;
  });
  return a({}, A)[S] != 7 || Object.keys(a({}, B)).join('') != K;
}) ? function assign(target, source) {
  var T = toObject(target),
      $$ = arguments,
      $$len = $$.length,
      index = 1,
      getKeys = $.getKeys,
      getSymbols = $.getSymbols,
      isEnum = $.isEnum;
  while ($$len > index) {
    var S = IObject($$[index++]),
        keys = getSymbols ? getKeys(S).concat(getSymbols(S)) : getKeys(S),
        length = keys.length,
        j = 0,
        key;
    while (length > j)
      if (isEnum.call(S, key = keys[j++]))
        T[key] = S[key];
  }
  return T;
} : Object.assign;
