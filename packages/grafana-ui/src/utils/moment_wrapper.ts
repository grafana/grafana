import moment, { MomentInput, DurationInputArg1 } from 'moment';

export interface DateTimeBuiltinFormat {
  __momentBuiltinFormatBrand: any;
}
export const ISO_8601: DateTimeBuiltinFormat = moment.ISO_8601;
export type DateTimeInput = Date | string | number | Array<string | number> | DateTimeType; // null | undefined
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
}

export interface DateTimeType extends Object {
  add: (amount?: DateTimeInput, unit?: DurationUnit) => DateTimeType;
  format: (formatInput?: FormatInput) => string;
  fromNow: (withoutSuffix?: boolean) => string;
  from: (formaInput: DateTimeInput) => string;
  isSame: (input?: DateTimeInput, granularity?: DurationUnit) => boolean;
  isValid: () => boolean;
  local: () => DateTimeType;
  locale: (locale: string) => DateTimeType;
  startOf: (unitOfTime: DurationUnit) => DateTimeType;
  subtract: (amount?: DateTimeInput, unit?: DurationUnit) => DateTimeType;
  toDate: () => Date;
  toISOString: () => string;
  valueOf: () => number;
  unix: () => number;
  utc: () => DateTimeType;
}

export const setLocale = (language: string) => {
  moment.locale(language);
};

export const getLocaleData = (): DateTimeLocale => {
  return moment.localeData();
};

export const isDateTimeType = (value: any): value is DateTimeType => {
  return moment.isMoment(value);
};

export const toUtc = (input?: DateTimeInput, formatInput?: FormatInput): DateTimeType => {
  return moment.utc(input as MomentInput, formatInput) as DateTimeType;
};

export const toDuration = (input?: DurationInput, unit?: DurationUnit): DateTimeDuration => {
  return moment.duration(input as DurationInputArg1, unit) as DateTimeDuration;
};

export const dateTimeType = (input?: DateTimeInput, formatInput?: FormatInput): DateTimeType => {
  return moment(input as MomentInput, formatInput) as DateTimeType;
};
