function roundDec(val, dec) {
    return Math.round(val * (dec = Math.pow(10, dec))) / dec;
}
export var SPACE_BETWEEN = 1;
export var SPACE_AROUND = 2;
export var SPACE_EVENLY = 3;
var coord = function (i, offs, iwid, gap) { return roundDec(offs + i * (iwid + gap), 6); };
/**
 * @internal
 */
export function distribute(numItems, sizeFactor, justify, onlyIdx, each) {
    var space = 1 - sizeFactor;
    /* eslint-disable no-multi-spaces */
    // prettier-ignore
    var gap = (justify === SPACE_BETWEEN ? space / (numItems - 1) :
        justify === SPACE_AROUND ? space / (numItems) :
            justify === SPACE_EVENLY ? space / (numItems + 1) : 0);
    if (isNaN(gap) || gap === Infinity) {
        gap = 0;
    }
    // prettier-ignore
    var offs = (justify === SPACE_BETWEEN ? 0 :
        justify === SPACE_AROUND ? gap / 2 :
            justify === SPACE_EVENLY ? gap : 0);
    /* eslint-enable */
    var iwid = sizeFactor / numItems;
    var _iwid = roundDec(iwid, 6);
    if (onlyIdx == null) {
        for (var i = 0; i < numItems; i++) {
            each(i, coord(i, offs, iwid, gap), _iwid);
        }
    }
    else {
        each(onlyIdx, coord(onlyIdx, offs, iwid, gap), _iwid);
    }
}
//# sourceMappingURL=distribute.js.map