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
  const str = '' + num;

  // Below 1e-6 (and at or above 1e21) JavaScript stringifies to exponential
  // notation, where splitting on '.' counts the exponent's characters instead
  // of decimal places: 1.5e-7 would otherwise report 4.
  const expIndex = str.indexOf('e');
  if (expIndex > -1) {
    const mantissaDecimals = (str.slice(0, expIndex).split('.')[1] || '').length;
    return Math.max(0, mantissaDecimals - Number(str.slice(expIndex + 1)));
  }

  return (str.split('.')[1] || '').length;
}
