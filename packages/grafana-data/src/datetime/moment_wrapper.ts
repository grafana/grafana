import { type TimeZone } from '../types/time';

import moment, { type MomentInput, type MomentLike as Moment, type MomentUnit } from './luxon_moment_compat/moment';

export type { Moment };

/* eslint-disable id-blacklist, no-restricted-imports */
export interface DateTimeBuiltinFormat {
  __momentBuiltinFormatBrand: any;
}
export const ISO_8601: DateTimeBuiltinFormat = moment.ISO_8601;
export type DateTimeInput = Date | string | number | Array<string | number> | DateTime | null; // | undefined;
export type FormatInput = string | DateTimeBuiltinFormat | undefined;
export type DurationInput = string | number | DateTimeDuration;
// same member set as the shim's MomentUnit; aliased so the two cannot drift apart
export type DurationUnit = MomentUnit;

export interface DateTimeLocale {
  firstDayOfWeek: () => number;
}

export interface DateTimeDuration {
  asHours: () => number;
  hours: () => number;
  minutes: () => number;
  seconds: () => number;
  asSeconds: () => number;
  asMilliseconds: () => number;
}

export interface DateTime extends Object {
  add: (amount?: DateTimeInput, unit?: DurationUnit) => DateTime;
  set: (unit: DurationUnit | 'date', amount: DateTimeInput) => void;
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
  toISOString: (keepOffset?: boolean) => string;
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

// package-internal (not re-exported from index.ts): lets hot paths hand a DateTimeInput straight
// to the shim factories without building an intermediate MomentLike copy first
export const toMomentInput = (input?: DateTimeInput): MomentInput => {
  // every `DateTime` this wrapper hands out is a shim `MomentLike` at runtime; the guard
  // intersection makes that visible to the compiler so the object (and its zone) passes through.
  if (moment.isMoment(input)) {
    return input;
  }

  // unreachable given the above, but it lets the compiler subtract `DateTime` from the union
  // (the `DateTime` and `MomentLike` interfaces are not structurally compatible).
  if (isDateTime(input)) {
    return input.valueOf();
  }

  return input;
};

// The public `DateTime` interface and the shim's `MomentLike` describe the same runtime objects
// but are structurally incompatible (e.g. `set` and `isoWeekday` differ), so handing a shim
// object out through the public interface needs one unchecked conversion.
const asDateTime = (value: Moment): DateTime => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return value as DateTime;
};

export const toUtc = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return asDateTime(moment.utc(toMomentInput(input), formatInput));
};

export const toDuration = (input?: DurationInput, unit?: DurationUnit): DateTimeDuration => {
  if (typeof input === 'string' || typeof input === 'number' || input == null) {
    return moment.duration(input, unit);
  }

  // duration-like objects carry their own magnitude, so `unit` does not apply (same as before,
  // when the shim took the object's `valueOf()` in milliseconds and ignored the unit).
  return moment.duration(input.asMilliseconds());
};

export const dateTime = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return asDateTime(moment(toMomentInput(input), formatInput));
};

export const dateTimeAsMoment = (input?: DateTimeInput) => {
  return moment(toMomentInput(input));
};

export const dateTimeForTimeZone = (
  timezone?: TimeZone,
  input?: DateTimeInput,
  formatInput?: FormatInput
): DateTime => {
  if (timezone && timezone !== 'browser') {
    if (typeof input === 'string' && formatInput) {
      return asDateTime(moment.tz(input, formatInput, timezone));
    }

    return asDateTime(moment.tz(toMomentInput(input), timezone));
  }

  return dateTime(input, formatInput);
};

export const guessBrowserTimeZone = (ignoreCache = false): string => {
  return moment.tz.guess(ignoreCache);
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
    moment.updateLocale(language + suffix, {
      parentLocale: language,
      week: {
        dow,
      },
    });
  } else {
    setLocale(language);
  }
};
