/* eslint-disable id-blacklist, no-restricted-imports */
import moment, { Moment } from 'moment-timezone';

import { formatDate } from '@grafana/i18n';

import { TimeZone } from '../types/time';
import { getFeatureToggle } from '../utils/featureToggles';

import { DateTimeOptions, getTimeZone } from './common';
import { systemDateFormats } from './formats';
import { DateTimeInput, toUtc, dateTimeAsMoment } from './moment_wrapper';

/**
 * Converts a Grafana DateTimeInput to a plain Javascript Date object.
 */
function toDate(dateInUtc: DateTimeInput): Date {
  if (dateInUtc instanceof Date) {
    return dateInUtc;
  }

  if (typeof dateInUtc === 'string' || typeof dateInUtc === 'number') {
    return new Date(dateInUtc);
  }

  return dateTimeAsMoment(dateInUtc).toDate();
}

/**
 * Converts a Grafana timezone string to an IANA timezone string.
 */
export function toIANATimezone(grafanaTimezone: string) {
  // Intl APIs will use the browser's timezone by default (if tz is undefined)
  if (grafanaTimezone === 'browser') {
    return undefined;
  }

  const zone = moment.tz.zone(grafanaTimezone);
  if (!zone) {
    // If the timezone is invalid, we default to the browser's timezone
    return undefined;
  }

  return grafanaTimezone;
}

function getIntlOptions(
  date: Date,
  options?: DateTimeOptionsWithFormat
): Intl.DateTimeFormatOptions & { timeZone?: string } {
  const timeZone = getTimeZone(options);

  const intlOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric', // ↔ dateStyle: 'short'
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric', // ↔ timeStyle: 'short'
    minute: 'numeric',
    timeZone: toIANATimezone(timeZone),
  };

  // If the time has seconds, ensure they're included in the format
  const hasSeconds = date.getSeconds() !== 0;
  if (hasSeconds) {
    intlOptions.second = 'numeric';
  }

  if (options?.defaultWithMS) {
    intlOptions.second = 'numeric';
    intlOptions.fractionalSecondDigits = 3; // Include milliseconds
  }

  return intlOptions;
}

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
 * Helper function to format date and time according to the specified options.
 * If no options are supplied, then the date is formatting according to the user's locale preference.
 *
 * @param dateInUtc - date in UTC format, e.g. string formatted with UTC offset, UNIX epoch in seconds etc.
 * @param options
 *
 * @public
 */
export const dateTimeFormat: DateTimeFormatter<DateTimeOptionsWithFormat> = (dateInUtc, options?) => {
  // If a custom format is provided (or the toggle isn't enabled), use the previous implementation
  if (!getFeatureToggle('localeFormatPreference') || options?.format) {
    return toTz(dateInUtc, getTimeZone(options)).format(getFormat(options));
  }

  const dateAsDate = toDate(dateInUtc);
  const intlOptions = getIntlOptions(dateAsDate, options); // TODO - if invalid timezone, use browser timezone
  return formatDate(dateAsDate, intlOptions);
};

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
  // If a custom format is provided (or the toggle isn't enabled), use the previous implementation
  if (!getFeatureToggle('localeFormatPreference') || options?.format) {
    return toTz(dateInUtc, getTimeZone(options)).format(`${systemDateFormats.fullDate} z`);
  }

  const dateAsDate = toDate(dateInUtc);
  const intlOptions = getIntlOptions(dateAsDate, options);
  intlOptions.timeZoneName = 'short';

  return formatDate(dateAsDate, intlOptions);
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
export const timeZoneAbbrevation: DateTimeFormatter = (dateInUtc, options?) =>
  toTz(dateInUtc, getTimeZone(options)).format('z');

const getFormat = <T extends DateTimeOptionsWithFormat>(options?: T): string => {
  if (options?.defaultWithMS) {
    return options?.format ?? systemDateFormats.fullDateMS;
  }
  return options?.format ?? systemDateFormats.fullDate;
};

const toTz = (dateInUtc: DateTimeInput, timeZone: TimeZone): Moment => {
  const date = dateInUtc;
  const zone = moment.tz.zone(timeZone);

  if (zone && zone.name) {
    return dateTimeAsMoment(toUtc(date)).tz(zone.name);
  }

  switch (timeZone) {
    case 'utc':
      return dateTimeAsMoment(toUtc(date));
    default:
      return dateTimeAsMoment(toUtc(date)).local();
  }
};
