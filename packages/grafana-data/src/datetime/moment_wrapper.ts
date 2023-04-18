import moment, { Moment, MomentInput, DurationInputArg1, DurationInputArg2 } from 'moment';

import { TimeZone } from '../types/time';
/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
export interface DateTimeBuiltinFormat {
  __momentBuiltinFormatBrand: any;
}
export const ISO_8601: DateTimeBuiltinFormat = moment.ISO_8601;
export type DateTimeInput = Date | string | number | Array<string | number> | DateTime | null; // | undefined;
export type FormatInput = string | DateTimeBuiltinFormat | undefined;
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

export interface DateTime extends Object {
  add: (amount?: DateTimeInput, unit?: DurationUnit) => DateTime;
  set: (unit: DurationUnit, amount: DateTimeInput) => void;
  diff: (amount: DateTimeInput, unit?: DurationUnit, truncate?: boolean) => number;
  endOf: (unitOfTime: DurationUnit) => DateTime;
  format: (formatInput?: FormatInput) => string;
  fromNow: (withoutSuffix?: boolean) => string;
  from: (formaInput: DateTimeInput) => string;
  isSame: (input?: DateTimeInput, granularity?: DurationUnit) => boolean;
  isBefore: (input?: DateTimeInput) => boolean;
  isValid: () => boolean;
  local: () => DateTime;
  locale: (locale: string) => DateTime;
  startOf: (unitOfTime: DurationUnit) => DateTime;
  subtract: (amount?: DateTimeInput, unit?: DurationUnit) => DateTime;
  toDate: () => Date;
  toISOString: () => string;
  isoWeekday: (day?: number | string) => number | string;
  valueOf: () => number;
  unix: () => number;
  utc: () => DateTime;
  utcOffset: () => number;
  hour?: () => number;
  minute?: () => number;
}

export const setLocale = (language: string) => {
  moment.locale(language);
};

export const getLocale = () => {
  return moment.locale();
};

export const getLocaleData = (): DateTimeLocale => {
  return moment.localeData();
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
  return moment.isMoment(value);
};

export const toUtc = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return moment.utc(input as MomentInput, formatInput) as DateTime;
};

export const toDuration = (input?: DurationInput, unit?: DurationUnit): DateTimeDuration => {
  // moment built-in types are a bit flaky, for example `isoWeek` is not in the type definition but it's present in the js source.
  return moment.duration(input as DurationInputArg1, unit as DurationInputArg2) as DateTimeDuration;
};

export const dateTime = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return moment(input as MomentInput, formatInput) as DateTime;
};

export const dateTimeAsMoment = (input?: DateTimeInput) => {
  return dateTime(input) as Moment;
};

export const dateTimeForTimeZone = (
  timezone?: TimeZone,
  input?: DateTimeInput,
  formatInput?: FormatInput
): DateTime => {
  if (timezone === 'utc') {
    return toUtc(input, formatInput);
  }
  if (timezone !== 'browser') {
    //@ts-ignore
    return moment.tz(input as MomentInput, formatInput, timezone) as DateTime;
  }

  return dateTime(input, formatInput);
};

export const getWeekdayIndex = (day: string) => {
  return moment.weekdays().findIndex((wd) => wd.toLowerCase() === day.toLowerCase());
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
    moment.locale(language + suffix, {
      parentLocale: language,
      week: {
        dow,
      },
    });
  } else {
    setLocale(language);
  }
};
