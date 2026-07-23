/* eslint-disable id-blacklist, no-restricted-imports */

import { type TimeZone } from '../types/time';

import { type DateTimeOptions, getTimeZone } from './common';
import { findTimeZoneAt } from './easytz_lookup';
import { systemDateFormats } from './formats';
import moment from './luxon_moment_compat/moment';
import { type DateTimeInput, type Moment, toUtc, dateTimeAsMoment } from './moment_wrapper';

/**
 * The type describing the options that can be passed to the {@link dateTimeFormat}
 * helper function to control how the date and time value passed to the function is
 * formatted.
 *
 * @public
 */
export interface DateTimeOptionsWithFormat extends DateTimeOptions {
  /**
   * Set this value to `true` if you want to include milliseconds when formatting date and time
   */
  defaultWithMS?: boolean;
}

type DateTimeFormatter<T extends DateTimeOptions = DateTimeOptions> = (dateInUtc: DateTimeInput, options?: T) => string;

// NOTE:
// These date formatting functions now just wrap the @grafana/i18n formatting functions
// (which themselves wrap the browserIntl APIs). In the future we may deprecate these
// in favor of using @grafana/i18n directly.

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
export const dateTimeFormatWithAbbrevation: DateTimeFormatter = (dateInUtc, options?) => {
  const timeZone = getTimeZone(options);
  const time = toTz(dateInUtc, timeZone);
  return `${time.format(systemDateFormats.fullDate)} ${zoneAbbreviation(time, timeZone)}`;
};

/**
 * Helper function to return only the time zone abbreviation for a given date and time value. If no options
 * are supplied, then default values are used. For more details please see {@link DateTimeOptions}.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export const timeZoneAbbrevation: DateTimeFormatter = (dateInUtc, options?) => {
  const timeZone = getTimeZone(options);
  return zoneAbbreviation(toTz(dateInUtc, timeZone), timeZone);
};

// The luxon-backed `z` token can only produce ICU's localized offset names (e.g. "GMT+2") for
// most zones, so the DST-correct abbreviation (CEST, EDT, ...) comes from the easy-tz dataset
// instead. Zone names that don't resolve to an IANA zone ('browser', unknown names) return ''
// for parity with moment's deprecated `z` token, which rendered '' on plain (non-moment-timezone)
// instances; 'utc' isn't in the easy-tz list and falls back to the shim's own `z` formatting ("UTC").
const zoneAbbreviation = (time: Moment, timeZone: TimeZone): string => {
  if (!moment.tz.isValidZone(timeZone)) {
    return '';
  }
  return findTimeZoneAt(timeZone, time.valueOf())?.abbr ?? time.format('z');
};

const getFormat = <T extends DateTimeOptionsWithFormat>(options?: T): string => {
  if (options?.defaultWithMS) {
    return options?.format ?? systemDateFormats.fullDateMS;
  }
  return options?.format ?? systemDateFormats.fullDate;
};

const toTz = (dateInUtc: DateTimeInput, timeZone: TimeZone): Moment => {
  const date = dateInUtc;

  if (moment.tz.isValidZone(timeZone)) {
    return dateTimeAsMoment(toUtc(date)).tz(timeZone);
  }

  switch (timeZone) {
    case 'utc':
      return dateTimeAsMoment(toUtc(date));
    default:
      return dateTimeAsMoment(toUtc(date)).local();
  }
};
