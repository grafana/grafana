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

// Counts decimals without JavaScript's exponential notation getting in the way:
// below 1e-6 (and at or above 1e21) `'' + num` yields something like '1.5e-7',
// where splitting on '.' counts the exponent's characters rather than decimal
// places. Built once and reused rather than per call.
//
// The locale is pinned because the decimal separator is locale dependent, and
// this reads the result rather than displaying it: 'de-DE' formats 0.125 as
// '0,125', which would count as no decimals at all. Grouping is off for the
// same reason, so 1234.5 stays '1234.5' instead of '1,234.5'.
//
// 100 is the largest maximumFractionDigits the spec allows (anything higher
// throws a RangeError), so values below ~1e-100 format to '0' and report no
// decimals. That matches the behaviour before this function handled
// exponential notation at all, and is far below any real panel data.
const decimalCounter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 100,
  useGrouping: false,
});

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
  return (decimalCounter.format(num).split('.')[1] || '').length;
}
