/* eslint-disable id-blacklist, no-restricted-imports */

import { formatRelativeTime } from '@grafana/i18n';

import { type TimeZone } from '../types/time';

import { type DateTimeOptions, getTimeZone } from './common';
import { systemDateFormats } from './formats';
import moment from './moment_implementation';
import { type DateTimeInput, type Moment, toMomentInput } from './moment_wrapper';

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

export interface DateTimeOptionsWithTimeAgo extends DateTimeOptions {
  now?: DateTimeInput;
}

type DateTimeFormatter<T extends DateTimeOptions = DateTimeOptions> = (dateInUtc: DateTimeInput, options?: T) => string;

/** Largest first; the first unit whose rounded count reaches 1 wins, so 59.6 minutes reads as 1h. */
const TIME_AGO_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
  ['second', 1000],
];

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
export const dateTimeFormatTimeAgo: DateTimeFormatter<DateTimeOptionsWithTimeAgo> = (dateInUtc, options?) => {
  const timeZone = getTimeZone(options);
  const date = toTz(dateInUtc, timeZone);

  return options?.now == null ? date.fromNow() : date.from(toTz(options.now, timeZone));
};

/**
 * Compact form of {@link dateTimeFormatTimeAgo} for dense lists: `11m ago`, `2h ago`, `3d ago`, `in 5m`.
 * Uses the browser's narrow relative-time style in the current language. A difference between two
 * instants is the same in every time zone, so none is taken.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options.now - reference instant; defaults to the current time
 *
 * @internal
 */
export function dateTimeFormatTimeAgoShort(dateInUtc: DateTimeInput, options?: { now?: DateTimeInput }): string {
  const date = moment.utc(toMomentInput(dateInUtc));
  if (!date.isValid()) {
    return 'Invalid date';
  }

  const now = options?.now == null ? Date.now() : moment.utc(toMomentInput(options.now)).valueOf();
  const diff = date.valueOf() - now;
  for (const [unit, size] of TIME_AGO_UNITS) {
    // Round the magnitude: Math.round(-1.5) is -1, which would make 45 days "1mo ago".
    const count = Math.sign(diff) * Math.round(Math.abs(diff) / size);
    if (Math.abs(count) >= 1) {
      return formatRelativeTime(count, unit, { style: 'narrow', numeric: 'always' });
    }
  }
  // Under half a second either way; -0 keeps the past-tense form ("0s ago", not "in 0s").
  return formatRelativeTime(-0, 'second', { style: 'narrow', numeric: 'always' });
}

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
  toTz(dateInUtc, getTimeZone(options)).format(`${systemDateFormats.fullDate} z`);

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
    return options?.format ?? systemDateFormats.fullDateMS;
  }
  return options?.format ?? systemDateFormats.fullDate;
};

// like moment's toUtc-then-convert pattern: the input is parsed in utc (zoneless strings are
// interpreted as UTC per this module's contract) and the instant is then converted to the target
// zone. Built as a single shim instance; the zone mutations don't reallocate.
const toTz = (dateInUtc: DateTimeInput, timeZone: TimeZone): Moment => {
  const inUtc = moment.utc(toMomentInput(dateInUtc));
  const zone = moment.tz.zone(timeZone);

  if (zone) {
    return inUtc.tz(zone.name);
  }

  switch (timeZone) {
    case 'utc':
      return inUtc;
    default:
      return inUtc.local();
  }
};
