/* */ 
var baseRandom = require('../internal/baseRandom'),
    isIterateeCall = require('../internal/isIterateeCall');
var nativeMin = Math.min,
    nativeRandom = Math.random;
function random(min, max, floating) {
  if (floating && isIterateeCall(min, max, floating)) {
    max = floating = undefined;
  }
  var noMin = min == null,
      noMax = max == null;
  if (floating == null) {
    if (noMax && typeof min == 'boolean') {
      floating = min;
      min = 1;
    } else if (typeof max == 'boolean') {
      floating = max;
      noMax = true;
    }
  }
  if (noMin && noMax) {
    max = 1;
    noMax = false;
  }
  min = +min || 0;
  if (noMax) {
    max = min;
    min = 0;
  } else {
    max = +max || 0;
  }
  if (floating || min % 1 || max % 1) {
    var rand = nativeRandom();
    return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand + '').length - 1)))), max);
  }
  return baseRandom(min, max);
}
module.exports = random;
