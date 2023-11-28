import { roundDecimals } from '@grafana/data';
export const SPACE_BETWEEN = 1;
export const SPACE_AROUND = 2;
export const SPACE_EVENLY = 3;
const coord = (i, offs, iwid, gap) => roundDecimals(offs + i * (iwid + gap), 6);
/**
 * @internal
 */
export function distribute(numItems, sizeFactor, justify, onlyIdx, each) {
    let space = 1 - sizeFactor;
    /* eslint-disable no-multi-spaces */
    // prettier-ignore
    let gap = (justify === SPACE_BETWEEN ? space / (numItems - 1) :
        justify === SPACE_AROUND ? space / (numItems) :
            justify === SPACE_EVENLY ? space / (numItems + 1) : 0);
    if (isNaN(gap) || gap === Infinity) {
        gap = 0;
    }
    // prettier-ignore
    let offs = (justify === SPACE_BETWEEN ? 0 :
        justify === SPACE_AROUND ? gap / 2 :
            justify === SPACE_EVENLY ? gap : 0);
    /* eslint-enable */
    let iwid = sizeFactor / numItems;
    let _iwid = roundDecimals(iwid, 6);
    if (onlyIdx == null) {
        for (let i = 0; i < numItems; i++) {
            each(i, coord(i, offs, iwid, gap), _iwid);
        }
    }
    else {
        each(onlyIdx, coord(onlyIdx, offs, iwid, gap), _iwid);
    }
}
//# sourceMappingURL=distribute.js.map