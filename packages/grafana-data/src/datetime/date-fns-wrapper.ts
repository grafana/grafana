import { Duration, Interval } from 'date-fns';
import intervalToDuration from 'date-fns/intervalToDuration';

const durationMap: { [key in Required<keyof Duration>]: string[] } = {
  years: ['y', 'Y', 'years'],
  months: ['M', 'months'],
  weeks: ['w', 'W', 'weeks'],
  days: ['d', 'D', 'days'],
  hours: ['h', 'H', 'hours'],
  minutes: ['m', 'minutes'],
  seconds: ['s', 'S', 'seconds'],
};

/**
 * Limits to specified precision and removes trailing 0s.
 * Examples:
 * (4.0001, 1) => 4
 * (4.1234, 1) => 4.1
 * (4.6789, 1) => 4.6
 */
function limitFloatingPrecision(x: number, precision: number): string {
  return parseFloat(x.toFixed(precision)).toString();
}

export function durationToAbbreviatedString(duration: Duration): string {
  return (Object.entries(duration) as Array<[keyof Duration, number | undefined]>).reduce((str, [unit, value]) => {
    if (value && value !== 0) {
      const padding = str !== '' ? ' ' : '';
      return str + `${padding}${value}${durationMap[unit][0]}`;
    }

    return str;
  }, '');
}

/**
 * Formats a duration provided in seconds. If smaller than 0, the most suitable
 * unit will be picked. Truncated at precision, not rounded.
 * (Ex.: (0.043678, 2) => '43.67 ms')
 */
export function formatDuration(duration: number, precision = 1): string {
  return duration > 1
    ? limitFloatingPrecision(duration, precision) + ' s'
    : duration * 1000 > 1
    ? limitFloatingPrecision(duration * 1000, precision) + ' ms'
    : limitFloatingPrecision(duration * 1000 * 1000, precision) + ' μs';
}

export function parseDuration(duration: string): Duration {
  return duration.split(' ').reduce<Duration>((acc, value) => {
    const match = value.match(/(\d+)(.+)/);
    if (match === null || match.length !== 3) {
      return acc;
    }

    const key = Object.entries(durationMap).find(([_, abbreviations]) => abbreviations?.includes(match[2]))?.[0];
    return !key ? acc : { ...acc, [key]: match[1] };
  }, {});
}

export function durationFromInterval(interval: Interval): Duration {
  return intervalToDuration(interval);
}
