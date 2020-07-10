/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import moment, { MomentInput, Moment } from 'moment-timezone';
import { TimeZone } from '../types';
import { DateTimeInput } from './moment_wrapper';
import { DEFAULT_DATE_TIME_FORMAT, MS_DATE_TIME_FORMAT } from './formats';
import { DateTimeOptions, getTimeZone } from './common';

/**
 * The type describing the options that can be passed to the {@link dateTimeFormat}
 * helper function to control how the date and time value passed to the function is
 * formatted.
 *
 * @public
 */
export interface DateTimeOptionsWithFormat extends DateTimeOptions {
  /**
   * Specify a {@link https://momentjs.com/docs/#/displaying/format | momentjs} format to
   * use a custom formatting pattern of the date and time value. If no format is set,
   * then {@link DEFAULT_DATE_TIME_FORMAT} is used.
   */
  format?: string;

  /**
   * Set this value to `true` if you want to include milliseconds when formatting date and time
   * values in the default {@link DEFAULT_DATE_TIME_FORMAT} format.
   */
  defaultWithMS?: boolean;
}

type DateTimeFormatter<T extends DateTimeOptions = DateTimeOptions> = (dateInUtc: DateTimeInput, options?: T) => string;

/**
 * Helper function to format date and time according to the specified options. If no options
 * are supplied, then default values are used. For more details, see {@link DateTimeOptionsWithFormat}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export const dateTimeFormat: DateTimeFormatter<DateTimeOptionsWithFormat> = (dateInUtc, options?) =>
  toTz(dateInUtc, getTimeZone(options)).format(getFormat(options));

/**
 * Helper function to format date and time according to the standard ISO format e.g. 2013-02-04T22:44:30.652Z.
 * If no options are supplied, then default values are used. For more details, see {@link DateTimeOptionsWithFormat}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export const dateTimeFormatISO: DateTimeFormatter = (dateInUtc, options?) =>
  toTz(dateInUtc, getTimeZone(options)).format();

/**
 * Helper function to return elapsed time since passed date. The returned value will be formatted
 * in a human readable format e.g. 4 years ago. If no options are supplied, then default values are used.
 * For more details, see {@link DateTimeOptions}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export const dateTimeFormatTimeAgo: DateTimeFormatter = (dateInUtc, options?) =>
  toTz(dateInUtc, getTimeZone(options)).fromNow();

/**
 * Helper function to format date and time according to the Grafana default formatting, but it
 * also appends the time zone abbreviation at the end e.g. 2020-05-20 13:37:00 CET. If no options
 * are supplied, then default values are used. For more details please see {@link DateTimeOptions}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export const dateTimeFormatWithAbbrevation: DateTimeFormatter = (dateInUtc, options?) =>
  toTz(dateInUtc, getTimeZone(options)).format(`${DEFAULT_DATE_TIME_FORMAT} z`);

/**
 * Helper function to return only the time zone abbreviation for a given date and time value. If no options
 * are supplied, then default values are used. For more details please see {@link DateTimeOptions}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export const timeZoneAbbrevation: DateTimeFormatter = (dateInUtc, options?) =>
  toTz(dateInUtc, getTimeZone(options)).format('z');

const getFormat = <T extends DateTimeOptionsWithFormat>(options?: T): string => {
  if (options?.defaultWithMS) {
    return options?.format ?? MS_DATE_TIME_FORMAT;
  }
  return options?.format ?? DEFAULT_DATE_TIME_FORMAT;
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
