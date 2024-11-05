import { add, Duration, intervalToDuration, Interval, isAfter } from 'date-fns';

const durationMap: Record<string, string[]> = {
  years: ['y', 'Y', 'years'],
  months: ['M', 'months'],
  weeks: ['w', 'W', 'weeks'],
  days: ['d', 'D', 'days'],
  hours: ['h', 'H', 'hours'],
  minutes: ['m', 'minutes'],
  seconds: ['s', 'S', 'seconds'],
} satisfies { [key in keyof Duration]: string[] };

/**
 * intervalToAbbreviatedDurationString converts interval to readable duration string
 *
 * @param interval - interval to convert
 * @param includeSeconds - optional, default true. If false, will not include seconds unless interval is less than 1 minute
 *
 * @public
 */
export function intervalToAbbreviatedDurationString(interval: Interval, includeSeconds = true): string {
  // An edge case that causes the app to crash (e.g. browser's clock behind the rule/alert date)
  // The code will again return a proper duration when the browser's clock >= rule/alert date
  if (isAfter(interval.start, interval.end)) {
    return '';
  }

  const duration = intervalToDuration(interval);
  return Object.entries(duration).reduce((str, [unit, value]) => {
    if (value && value !== 0 && !(unit === 'seconds' && !includeSeconds && str)) {
      const padding = str !== '' ? ' ' : '';
      return str + `${padding}${value}${durationMap[unit][0]}`;
    }

    return str;
  }, '');
}

/**
 * parseDuration parses duration string into datefns Duration object
 *
 * @param durationString - string to convert. For example '2m', '5h 20s'
 *
 * @public
 */
export function parseDuration(durationString: string): Duration {
  return durationString.split(' ').reduce<Duration>((acc, value) => {
    const match = value.match(/(\d+)(.+)/);

    const rawLength = match?.[1];
    const unit = match?.[2];

    if (!(rawLength && unit)) {
      return acc;
    }

    const mapping = Object.entries(durationMap).find(([_, abbreviations]) => abbreviations?.includes(match[2]));
    const length = parseInt(rawLength, 10);

    return mapping ? { ...acc, [mapping[0]]: length } : acc;
  }, {});
}

/**
 * addDurationToDate adds given duration to given date and returns a new Date object
 *
 * @param date - date to add to. Can be either Date object or a number (milliseconds since epoch)
 * @param duration - duration to add. For example '2m', '5h 20s'
 *
 * @public
 */
export function addDurationToDate(date: Date | number, duration: Duration): Date {
  return add(date, duration);
}

/**
 * durationToMilliseconds convert a duration object to milliseconds
 *
 * @param duration - datefns Duration object
 *
 * @public
 */
export function durationToMilliseconds(duration: Duration): number {
  const now = new Date();
  return addDurationToDate(now, duration).getTime() - now.getTime();
}

/**
 * isValidDate returns true if given string can be parsed into valid Date object, false otherwise
 *
 * @param dateString - string representation of a date
 *
 * @public
 */
export function isValidDate(dateString: string): boolean {
  return !isNaN(Date.parse(dateString));
}

/**
 * isValidDuration returns true if the given string can be parsed into a valid `date-fns` `Duration` object, false otherwise
 *
 * Valid time units are "y", "Y", "years", "M", "months", "w", "W", "weeks", "d", "D", "days", "h", "H", "hours", "m", "minutes", "s", "S", "seconds"
 *
 * @see https://date-fns.org/v2.30.0/docs/Duration
 * @param durationString - string representation of a duration
 *
 * @public
 */
export function isValidDuration(durationString: string): boolean {
  for (const value of durationString.trim().split(' ')) {
    const match = value.match(/(\d+)(.+)/);
    if (match === null || match.length !== 3) {
      return false;
    }

    const key = Object.entries(durationMap).find(([_, abbreviations]) => abbreviations?.includes(match[2]))?.[0];
    if (!key) {
      return false;
    }
  }

  return true;
}

/**
 * isValidGoDuration returns true if the given string can be parsed into a valid Duration object based on
 * Go's time.parseDuration, false otherwise.
 *
 * Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h".
 *
 * @see https://pkg.go.dev/time#ParseDuration
 *
 * @param durationString - string representation of a duration
 *
 * @internal
 */
export function isValidGoDuration(durationString: string): boolean {
  const timeUnits = ['h', 'm', 's', 'ms', 'us', 'µs', 'ns'];
  return validateDurationByUnits(durationString, timeUnits);
}

/**
 * isValidGrafanaDuration returns `true` if the given string can be parsed into a valid Duration object based on
 * the Grafana SDK's gtime.parseDuration, `false` otherwise.
 *
 * Valid time units are "ns", "us" (or "µs"), "ms", "s", "m", "h", "d", "w", "M", "y".
 *
 * @see https://pkg.go.dev/github.com/grafana/grafana-plugin-sdk-go/backend/gtime#ParseDuration
 *
 * @param durationString - string representation of a duration
 *
 * @internal
 */
export function isValidGrafanaDuration(durationString: string): boolean {
  const timeUnits = ['y', 'M', 'w', 'd', 'h', 'm', 's', 'ms', 'us', 'µs', 'ns'];
  return validateDurationByUnits(durationString, timeUnits);
}

function validateDurationByUnits(durationString: string, timeUnits: string[]): boolean {
  for (const value of durationString.trim().split(' ')) {
    const match = value.match(/([0-9]*[.]?[0-9]+)(.+)/);
    if (match === null || match.length !== 3) {
      return false;
    }

    const isValidUnit = timeUnits.includes(match[2]);
    if (!isValidUnit) {
      return false;
    }
  }

  return true;
}
