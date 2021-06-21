import { Duration, Interval } from 'date-fns';
import intervalToDuration from 'date-fns/intervalToDuration';
import add from 'date-fns/add';

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
 * intervalToAbbreviatedDurationString convers interval to readable duration string
 *
 * @param interval - interval to convert
 * @param includeSeconds - optional, default true. If false, will not include seconds unless interval is less than 1 minute
 *
 * @public
 */
export function intervalToAbbreviatedDurationString(interval: Interval, includeSeconds = true): string {
  const duration = intervalToDuration(interval);
  return (Object.entries(duration) as Array<[keyof Duration, number | undefined]>).reduce((str, [unit, value]) => {
    if (value && value !== 0 && !(unit === 'seconds' && !includeSeconds && str)) {
      const padding = str !== '' ? ' ' : '';
      return str + `${padding}${value}${durationMap[unit][0]}`;
    }

    return str;
  }, '');
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

export function addDurationToDate(date: Date | number, duration: Duration): Date {
  return add(date, duration);
}

export function durationToMilliseconds(duration: Duration): number {
  const now = new Date();
  return addDurationToDate(now, duration).getTime() - now.getTime();
}

export function isValidDate(dateString: string) {
  return !isNaN(Date.parse(dateString));
}
