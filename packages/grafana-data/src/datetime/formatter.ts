/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import { TimeZone, DefaultTimeZone } from '../types';
import moment, { MomentInput, Moment } from 'moment-timezone';
import { DateTimeInput } from './moment_wrapper';
import { DEFAULT_DATE_TIME_FORMAT, MS_DATE_TIME_FORMAT } from './formats';

export type TimeZoneResolver = () => TimeZone | undefined;

let defaultTimeZoneResolver: TimeZoneResolver = () => DefaultTimeZone;

export const setTimeZoneResolver = (resolver: TimeZoneResolver) => {
  defaultTimeZoneResolver = resolver ?? defaultTimeZoneResolver;
};

export interface DateTimeOptions {
  timeZone?: TimeZone;
}

export interface DateTimeOptionsWithFormat extends DateTimeOptions {
  format?: string;
  defaultWithMS?: boolean;
}

export type DateTimeFormatter<T extends DateTimeOptions = DateTimeOptions> = (
  dateInUtc: DateTimeInput,
  options?: T
) => string;

export const dateTimeFormat: DateTimeFormatter<DateTimeOptionsWithFormat> = (
  dateInUtc: DateTimeInput,
  options?: DateTimeOptionsWithFormat
) => toTz(dateInUtc, getTimeZone(options)).format(getFormat(options));

export const dateTimeFormatISO: DateTimeFormatter = (dateInUtc: DateTimeInput, options?: DateTimeOptions) =>
  toTz(dateInUtc, getTimeZone(options)).format();

export const dateTimeFormatTimeAgo: DateTimeFormatter = (dateInUtc: DateTimeInput, options?: DateTimeOptions) =>
  toTz(dateInUtc, getTimeZone(options)).fromNow();

export const dateTimeFormatWithAbbrevation: DateTimeFormatter = (dateInUtc: DateTimeInput, options?: DateTimeOptions) =>
  toTz(dateInUtc, getTimeZone(options)).format(`${DEFAULT_DATE_TIME_FORMAT} z`);

export const timeZoneAbbrevation: DateTimeFormatter = (dateInUtc: DateTimeInput, options?: DateTimeOptions) => {
  const timeZone = getTimeZone(options);
  const zone = moment.tz.zone(timeZone);

  if (zone && zone.name) {
    return toTz(dateInUtc, zone.name).format('z');
  }

  switch (timeZone) {
    case 'utc':
      return 'UTC';
    default:
      return '';
  }
};

const getFormat = <T extends DateTimeOptionsWithFormat>(options?: T): string => {
  if (options?.defaultWithMS) {
    return options?.format ?? MS_DATE_TIME_FORMAT;
  }
  return options?.format ?? DEFAULT_DATE_TIME_FORMAT;
};

const getTimeZone = <T extends DateTimeOptions>(options?: T): TimeZone => {
  return options?.timeZone ?? defaultTimeZoneResolver() ?? DefaultTimeZone;
};

const toTz = (dateInUtc: DateTimeInput, timeZone: TimeZone): Moment => {
  const date = dateInUtc as MomentInput;
  const zone = moment.tz.zone(timeZone);

  if (zone && zone.name) {
    return moment.utc(date).tz(zone.name);
  }

  switch (timeZone) {
    case 'utc':
      return moment.utc(date);
    default:
      return moment.utc(date).local();
  }
};
