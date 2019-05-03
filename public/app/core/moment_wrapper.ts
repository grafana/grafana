import moment, { MomentInput } from 'moment';

export interface DateTimeBuiltinFormat {
  __momentBuiltinFormatBrand: any;
}
export const ISO_8601: DateTimeBuiltinFormat = moment.ISO_8601;
export type DateTimeInput = Date | string | number | Array<string | number> | DateTimeType; // null | undefined
export type FormatInput = string | DateTimeBuiltinFormat | undefined;

export interface DateTimeType {
  format: (formaInput: FormatInput) => string;
  fromNow: () => string;
  isValid: () => boolean;
  local: () => DateTimeType;
  toDate: () => Date;
  toISOString: () => string;
  valueOf: () => number;
  unix: () => number;
  utc: (keepLocalTime?: boolean) => DateTimeType;
}

export const toUtc = (input?: DateTimeInput, formatInput?: FormatInput): DateTimeType => {
  return moment.utc(input as MomentInput, formatInput) as DateTimeType;
};

export const isDateTimeType = (value: any): value is DateTimeType => {
  return moment.isMoment(value);
};

export const momentWrapper = (input?: DateTimeInput, formatInput?: FormatInput): DateTimeType => {
  return moment(input as MomentInput, formatInput) as DateTimeType;
};
