// BREAKS
const D = '-'.charCodeAt(0);
// const N = "\n".charCodeAt(0);
// const R = "\r".charCodeAt(0);
const S = ' '.charCodeAt(0);
// const T = "\t".charCodeAt(0);

const SYMBS = `\`~!@#$%^&*()_+-=[]\\{}|;':",./<>?`;
const NUMS = '1234567890';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const CHARS = `${UPPER}${LOWER}${NUMS}${SYMBS}`;

// TODO: customize above via opts
// TODO: respect explicit breaks
// TODO: instead of ctx, pass in font, letterSpacing, wordSpacing
export function uWrap(ctx: CanvasRenderingContext2D) {
  // TODO: wordSpacing
  const letterSpacing = parseFloat(ctx.letterSpacing);

  // single-char widths in isolation
  const WIDTHS: Record<number, number> = {};

  for (let i = 0; i < CHARS.length; i++) {
    WIDTHS[CHARS.charCodeAt(i)] = ctx.measureText(CHARS[i]).width + letterSpacing;
  }

  // build kerning/spacing LUT of upper+lower, upper+sym, upper+upper pairs. (this includes letterSpacing)
  const PAIRS: Record<number, Record<number, number>> = {};

  for (let i = 0; i < UPPER.length; i++) {
    let uc = UPPER.charCodeAt(i);
    PAIRS[uc] = {};

    for (let j = 0; j < CHARS.length; j++) {
      let ch = CHARS.charCodeAt(j);
      let wid = ctx.measureText(`${UPPER[i]}${CHARS[j]}`).width - WIDTHS[ch] - letterSpacing;
      PAIRS[uc][ch] = wid;
    }
  }

  type EachLine = (idx0: number, idx1: number) => void;

  const eachLine: EachLine = () => {};

  function each(text: string, width: number, cb: EachLine = eachLine) {
    let headIdx = 0;
    let headEnd = 0;
    let headWid = 0;

    let tailIdx = -1; // wrap candidate
    let tailWid = 0;

    let inWS = false;

    for (let i = 0; i < text.length; i++) {
      let c = text.charCodeAt(i);

      let w = 0;

      if (c in PAIRS) {
        let n = text.charCodeAt(i + 1);

        if (n in PAIRS[c]) {
          w = PAIRS[c][n];
        }
      }

      if (w === 0) {
        w = WIDTHS[c] ?? (WIDTHS[c] = ctx.measureText(text[i]).width);
      }

      if (c === S) {
        //  || c === T || c === N || c === R
        // set possible wrap point
        if (text.charCodeAt(i + 1) !== c) {
          tailIdx = i + 1;
          tailWid = 0;
        }

        if (!inWS && headWid > 0) {
          headWid += w;
          headEnd = i;
        }

        inWS = true;
      } else {
        if (headWid + w > width) {
          cb(headIdx, headEnd);

          headWid = tailWid + w;
          headIdx = headEnd = tailIdx;
          tailWid = 0;
          tailIdx = -1;
        } else {
          if (c === D) {
            // set possible wrap point
            if (text.charCodeAt(i + 1) !== c) {
              tailIdx = headEnd = i + 1;
              tailWid = 0;
            }
          }

          headWid += w;
          tailWid += w;
        }

        inWS = false;
      }
    }

    cb(headIdx, text.length - 1);
  }

  return {
    each,
  };
}
