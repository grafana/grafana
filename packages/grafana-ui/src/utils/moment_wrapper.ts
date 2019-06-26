/* tslint:disable:import-blacklist ban ban-types */
import moment, { MomentInput, DurationInputArg1 } from 'moment';

export interface DateTimeBuiltinFormat {
  __momentBuiltinFormatBrand: any;
}
export const ISO_8601: DateTimeBuiltinFormat = moment.ISO_8601;
export type DateTimeInput = Date | string | number | Array<string | number> | DateTime; // null | undefined
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
}

export const setLocale = (language: string) => {
  moment.locale(language);
};

export const getLocaleData = (): DateTimeLocale => {
  return moment.localeData();
};

export const isDateTime = (value: any): value is DateTime => {
  return moment.isMoment(value);
};

export const toUtc = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return moment.utc(input as MomentInput, formatInput) as DateTime;
};

export const toDuration = (input?: DurationInput, unit?: DurationUnit): DateTimeDuration => {
  return moment.duration(input as DurationInputArg1, unit) as DateTimeDuration;
};

export const dateTime = (input?: DateTimeInput, formatInput?: FormatInput): DateTime => {
  return moment(input as MomentInput, formatInput) as DateTime;
};
