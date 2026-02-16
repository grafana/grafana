import dayjs from 'dayjs';
import { Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localeData from 'dayjs/plugin/localeData';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import updateLocale from 'dayjs/plugin/updateLocale';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import arraySupport from 'dayjs/plugin/arraySupport';
import isoWeek from 'dayjs/plugin/isoWeek';

import { TimeZone } from '../types/time';

// Extend dayjs with plugins
dayjs.extend(arraySupport);
dayjs.extend(isoWeek);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(duration);
dayjs.extend(localeData);
dayjs.extend(updateLocale);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(relativeTime);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(isBetween);
dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);

// ISO_8601 format constant compatible with dayjs
export const ISO_8601 = 'YYYY-MM-DDTHH:mm:ss.SSSZ';

export type DateTimeInput = Date | string | number | Array<string | number> | DateTime | null;
export type FormatInput = string | undefined;
export type DurationInput = string | number | DateTimeDuration;
export type DurationUnit =
  | 'year'
  | 'years'
  | 'y'
  | 'month'
  | 'months'
  | 'M'
  | 'week'
  | 'weeks'
  | 'isoWeek'
  | 'w'
  | 'day'
  | 'days'
  | 'd'
  | 'hour'
  | 'hours'
  | 'h'
  | 'minute'
  | 'minutes'
  | 'm'
  | 'second'
  | 'seconds'
  | 's'
  | 'millisecond'
  | 'milliseconds'
  | 'ms'
  | 'quarter'
  | 'quarters'
  | 'Q';

export interface DateTimeLocale {
  firstDayOfWeek: () => number;
}

export interface DateTimeDuration {
  asHours: () => number;
  hours: () => number;
  minutes: () => number;
  seconds: () => number;
  asSeconds: () => number;
}

export type DateTime = Dayjs;

// Map duration units from our format to dayjs format
const durationUnitMap: Record<string, dayjs.ManipulateType | 'quarter'> = {
  year: 'year',
  years: 'year',
  y: 'year',
  month: 'month',
  months: 'month',
  M: 'month',
  week: 'week',
  weeks: 'week',
  isoWeek: 'week',
  w: 'week',
  day: 'day',
  days: 'day',
  d: 'day',
  hour: 'hour',
  hours: 'hour',
  h: 'hour',
  minute: 'minute',
  minutes: 'minute',
  m: 'minute',
  second: 'second',
  seconds: 'second',
  s: 'second',
  millisecond: 'millisecond',
  milliseconds: 'millisecond',
  ms: 'millisecond',
  quarter: 'quarter',
  quarters: 'quarter',
  Q: 'quarter',
};

export const setLocale = (language: string) => {
  dayjs.locale(language);
};

export const getLocale = () => {
  return dayjs.locale();
};

export const getLocaleData = (): DateTimeLocale => {
  const localeData = dayjs.localeData();
  return {
    firstDayOfWeek: () => localeData.firstDayOfWeek(),
  };
};

export const isDateTimeInput = (value: unknown): value is DateTimeInput => {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    value instanceof Date ||
    (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) ||
    isDateTime(value)
  );
};

export const isDateTime = (value: unknown): value is DateTime => {
  return dayjs.isDayjs(value);
};

export const toUtc = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  if (input === null || input === undefined) {
    return dayjs.utc() as unknown as DateTime;
  }

  if (formatInput) {
    const formatStr = typeof formatInput === 'string' ? formatInput : 'YYYY-MM-DDTHH:mm:ssZ';
    return dayjs.utc(input as string, formatStr) as unknown as DateTime;
  }

  return dayjs.utc(input as string | number | Date | Dayjs) as unknown as DateTime;
};

export const toDuration = (input?: DurationInput, unit?: DurationUnit): DateTimeDuration => {
  if (input === undefined || input === null) {
    return dayjs.duration(0) as unknown as DateTimeDuration;
  }

  const dayjsUnit = unit ? durationUnitMap[unit] || 'millisecond' : 'millisecond';

  // Handle object input (DateTimeDuration)
  if (typeof input === 'object' && !Array.isArray(input)) {
    return dayjs.duration(input as unknown as Record<string, number>) as unknown as DateTimeDuration;
  }

  return dayjs.duration(input as number, dayjsUnit as dayjs.ManipulateType) as unknown as DateTimeDuration;
};

export const dateTime = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  if (input === null || input === undefined) {
    return dayjs() as unknown as DateTime;
  }

  // Handle DateTime objects (Dayjs instances)
  if (dayjs.isDayjs(input)) {
    return input as unknown as DateTime;
  }

  // Handle format string
  if (formatInput && typeof formatInput === 'string') {
    return dayjs(input as string, formatInput) as unknown as DateTime;
  }

  // Default parsing
  return dayjs(input as string | number | Date) as unknown as DateTime;
};

/**
 * @deprecated Use dateTime() instead. This function is provided for backward compatibility.
 */
export const dateTimeAsMoment = (input?: DateTimeInput) => {
  return dateTime(input) as unknown as Dayjs;
};

function ensurePadded(value: number, length: number = 2): string {
  return value.toString().padStart(length, '0');
}

function inputArraySizeToStr(input: number[]) {
  if (input.length >= 2) {
    input[1] = input[1] + 1; // month is 0 indexed in dayjs, but 1 indexed in our input
  }

  if (input.length > 3 && input[3] > 12) {
    input[3] = input[3] - 12;
  }

  const paddedInput = input.map((v) => ensurePadded(v));

  switch (input.length) {
    case 1:
      return [paddedInput[0], 'YYYY'];
    case 2:
      return [paddedInput.join('/'), 'YYYY/MM'];
    case 3:
      return [paddedInput.join('/'), 'YYYY/MM/DD'];
    case 4:
      return [paddedInput.slice(0, 3).join('/') + ' ' + paddedInput[3], 'YYYY/MM/DD hh'];
    case 5:
      return [paddedInput.slice(0, 3).join('/') + ' ' + paddedInput.slice(3).join(':'), 'YYYY/MM/DD hh:mm'];
    case 6:
      return [paddedInput.slice(0, 3).join('/') + ' ' + paddedInput.slice(3).join(':'), 'YYYY/MM/DD hh:mm:ss'];
    case 7:
      return [
        paddedInput.slice(0, 3).join('/') + ' ' + paddedInput.slice(3, 6).join(':') + '.' + ensurePadded(input[6], 3),
        'YYYY/MM/DD hh:mm:ss.SSS',
      ];
    default:
      throw new Error('Invalid input array size for date parsing');
  }
}

export const dateTimeForTimeZone = (
  timezone?: TimeZone,
  input?: DateTimeInput,
  formatInput?: FormatInput
): DateTime => {
  try {
    if (timezone && timezone !== 'browser') {
      let result: Dayjs;

      if (Array.isArray(input)) {
        // for some reason, the .tz does not support array input
        [input, formatInput] = inputArraySizeToStr(input as number[]);
      }

      if (dayjs.isDayjs(input)) {
        result = input.isValid() ? input.tz(timezone) : input;
      } else if (typeof input === 'string' && formatInput && typeof formatInput === 'string') {
        result = dayjs.tz(input, formatInput, timezone);
      } else if (input !== null && input !== undefined) {
        result = dayjs.tz(input as string | number | Date, timezone);
      } else {
        result = dayjs().tz(timezone);
      }

      if (result.isValid()) {
        return result as unknown as DateTime;
      }
    }

    return dateTime(input, formatInput);
  } catch (e) {
    return dayjs('invalid')
  }
};

export const getWeekdayIndex = (day: string) => {
  const weekdays = dayjs.weekdays();
  return weekdays.findIndex((wd) => wd.toLowerCase() === day.toLowerCase());
};

export const getWeekdayIndexByEnglishName = (day: string) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].findIndex(
    (wd) => wd.toLowerCase() === day.toLowerCase()
  );

export const setWeekStart = (weekStart?: string) => {
  const suffix = '-weekStart';
  const language = getLocale().replace(suffix, '');
  const dow = weekStart ? getWeekdayIndexByEnglishName(weekStart) : -1;
  if (dow !== -1) {
    dayjs.updateLocale(language + suffix, {
      weekStart: dow,
    });
  } else {
    setLocale(language);
  }
};

export const getTimeZoneInfo = (zone: string) => {
  try {
    // Use Intl API to get timezone info since dayjs doesn't have this built-in
    return {
      name: zone,
    };
  } catch (e) {
    return null;
  }
};

export const guessTimeZone = (): string => {
  return dayjs.tz.guess();
};

export const getTimeZones = (): string[] => {
  // Use Intl API to get supported timezones
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch (e) {
    // Fallback to common timezones if Intl API not available
    return ['UTC'];
  }
};
