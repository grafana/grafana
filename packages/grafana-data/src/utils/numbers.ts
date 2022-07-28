// https://stackoverflow.com/a/48764436
// rounds half away from zero
export function roundDec(val: number, dec = 0) {
  let p = 10 ** dec;
  let n = val * p * (1 + Number.EPSILON);
  return Math.round(n) / p;
}

export function guessDec(num: number) {
  return (('' + num).split('.')[1] || '').length;
}
