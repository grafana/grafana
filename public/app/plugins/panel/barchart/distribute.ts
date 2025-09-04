import { roundDecimals } from '@grafana/data';

export const SPACE_BETWEEN = 1;
export const SPACE_AROUND = 2;
export const SPACE_EVENLY = 3;

const coord = (i: number, offs: number, iwid: number, gap: number) => roundDecimals(offs + i * (iwid + gap), 6);

export type Each = (idx: number, offPct: number, dimPct: number) => void;

/**
 * @internal
 */
export function distribute(numItems: number, sizeFactor: number, justify: number, onlyIdx: number | null, each: Each) {
  let space = 1 - sizeFactor;

  // prettier-ignore
  let gap = (
    justify === SPACE_BETWEEN ? space / (numItems - 1) :
    justify === SPACE_AROUND  ? space / (numItems  )   :
    justify === SPACE_EVENLY  ? space / (numItems + 1) : 0
  );

  if (isNaN(gap) || gap === Infinity) {
    gap = 0;
  }

  // prettier-ignore
  let offs = (
    justify === SPACE_BETWEEN ? 0       :
    justify === SPACE_AROUND  ? gap / 2 :
    justify === SPACE_EVENLY  ? gap     : 0
  );

  let iwid = sizeFactor / numItems;
  let _iwid = roundDecimals(iwid, 6);

  if (onlyIdx == null) {
    for (let i = 0; i < numItems; i++) {
      each(i, coord(i, offs, iwid, gap), _iwid);
    }
  } else {
    each(onlyIdx, coord(onlyIdx, offs, iwid, gap), _iwid);
  }
}
