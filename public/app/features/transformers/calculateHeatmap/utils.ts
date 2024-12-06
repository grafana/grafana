import { durationToMilliseconds, guessDecimals, isValidDuration, parseDuration, roundDecimals } from '@grafana/data';

import { numberOrVariableValidator } from '../utils';

const { abs, pow } = Math;

export const fixedDec = new Map();

export function genIncrs(base: number, minExp: number, maxExp: number, mults: number[]) {
  let incrs = [];

  let multDec = mults.map(guessDecimals);

  for (let exp = minExp; exp < maxExp; exp++) {
    let expa = abs(exp);
    let mag = roundDecimals(pow(base, exp), expa);

    for (let i = 0; i < mults.length; i++) {
      let _incr = mults[i] * mag;
      let dec = (_incr >= 0 && exp >= 0 ? 0 : expa) + (exp >= multDec[i] ? 0 : multDec[i]);
      let incr = roundDecimals(_incr, dec);
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

const sec = 1 * 1e3;
const min = 60 * sec;
const hour = 60 * min;
const day = 24 * hour;
const year = 365 * day;

// in milliseconds
export const niceTimeIncrs = [
  1,
  2,
  4,
  5,
  10,
  20,
  25,
  40,
  50,
  100,
  200,
  250,
  400,
  500,

  sec,
  2 * sec,
  4 * sec,
  5 * sec,
  10 * sec,
  15 * sec,
  20 * sec,
  30 * sec,

  min,
  2 * min,
  4 * min,
  5 * min,
  10 * min,
  15 * min,
  20 * min,
  30 * min,

  hour,
  2 * hour,
  4 * hour,
  6 * hour,
  8 * hour,
  12 * hour,
  18 * hour,

  day,
  2 * day,
  3 * day,
  4 * day,
  5 * day,
  6 * day,
  7 * day,
  10 * day,
  15 * day,
  30 * day,
  45 * day,
  60 * day,
  90 * day,
  180 * day,

  year,
  2 * year,
  3 * year,
  4 * year,
  5 * year,
  6 * year,
  7 * year,
  8 * year,
  9 * year,
  10 * year,
];

// convert a string to the number of milliseconds. valid inputs are a number, variable, or duration. duration in ms is supported.
// value out will always be an integer, as ms is the lowest granularity for heatmaps
export const convertDurationToMilliseconds = (duration: string): number | undefined => {
  const isValidNumberOrVariable = numberOrVariableValidator(duration); // check if number only. if so, equals number of ms
  if (isValidNumberOrVariable) {
    const durationMs = Number.parseInt(duration, 10);
    return Number.isNaN(durationMs) ? undefined : durationMs;
  } else {
    const validDuration = isValidDuration(duration); // check if non-ms duration. If so, convert value to number of ms
    if (validDuration) {
      return durationToMilliseconds(parseDuration(duration));
    } else {
      const match = duration.match(/(\d+)ms$/i);
      if (match) {
        const durationMs = Number.parseInt(match[1], 10);
        return Number.isNaN(durationMs) ? undefined : durationMs;
      } else {
        return undefined;
      }
    }
  }
};
