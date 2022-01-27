const { abs, round, pow } = Math;

export function roundDec(val: number, dec: number) {
  return round(val * (dec = 10 ** dec)) / dec;
}

export const fixedDec = new Map();

export function guessDec(num: number) {
  return (('' + num).split('.')[1] || '').length;
}

export function genIncrs(base: number, minExp: number, maxExp: number, mults: number[]) {
  let incrs = [];

  let multDec = mults.map(guessDec);

  for (let exp = minExp; exp < maxExp; exp++) {
    let expa = abs(exp);
    let mag = roundDec(pow(base, exp), expa);

    for (let i = 0; i < mults.length; i++) {
      let _incr = mults[i] * mag;
      let dec = (_incr >= 0 && exp >= 0 ? 0 : expa) + (exp >= multDec[i] ? 0 : multDec[i]);
      let incr = roundDec(_incr, dec);
      incrs.push(incr);
      fixedDec.set(incr, dec);
    }
  }

  return incrs;
}

const onlyWhole = (v: number) => v % 1 === 0;

const allMults = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];

// ...0.01, 0.02, 0.025, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5...
export const decIncrs = genIncrs(10, -16, 0, allMults);

// 1, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 30, 40, 50...
export const oneIncrs = genIncrs(10, 0, 16, allMults);

// 1, 2,      3, 4, 5, 10, 20, 25, 50...
export const wholeIncrs = oneIncrs.filter(onlyWhole);

export const numIncrs = decIncrs.concat(oneIncrs);

export const niceLinearIncrs = decIncrs.concat(wholeIncrs);
