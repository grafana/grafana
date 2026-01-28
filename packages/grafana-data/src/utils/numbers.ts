/**
 * Round half away from zero ('commercial' rounding)
 * Uses correction to offset floating-point inaccuracies.
 * Works symmetrically for positive and negative numbers.
 *
 * ref: https://stackoverflow.com/a/48764436
 */
export function roundDecimals(val: number, dec = 0) {
  if (Number.isInteger(val)) {
    return val;
  }

  let p = 10 ** dec;
  let n = val * p * (1 + Number.EPSILON);
  return Math.round(n) / p;
}

/**
 * Tries to guess number of decimals needed to format a number
 *
 * used for determining minimum decimals required to uniformly
 * format a numric sequence, e.g. 10, 10.125, 10.25, 10.5
 *
 * good for precisce increments:  0.125            -> 3
 * bad  for arbitrary floats:     371.499999999999 -> 12
 */
export function guessDecimals(num: number) {
  if (num === 0 || !Number.isFinite(num)) {
    return 0;
  }

  const str = num.toString();
  const parts = str.split('.');
  if (parts.length === 1) {
    if (str.indexOf('e-') !== -1) {
      return parseInt(str.split('e-')[1], 10);
    }
    return 0;
  }

  const dotPart = parts[1];
  const exponentIndex = dotPart.indexOf('e');
  if (exponentIndex === -1) {
    return dotPart.length;
  }

  const fraction = dotPart.substring(0, exponentIndex);
  const exponent = parseInt(dotPart.substring(exponentIndex + 1), 10);

  if (exponent < 0) {
    return fraction.length + Math.abs(exponent);
  }

  return Math.max(0, fraction.length - exponent);
}
