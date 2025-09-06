import { lowerCase } from 'lodash';
import moment from 'moment-timezone';

import { DateTimeOptions, getTimeZone } from './common';
import { parse, isValid } from './datemath';
import { systemDateFormats } from './formats';
import { DateTimeInput, DateTime, isDateTime, dateTime, toUtc, dateTimeForTimeZone } from './moment_wrapper';

/**
 * The type that describes options that can be passed when parsing a date and time value.
 * @public
 */
export interface DateTimeOptionsWhenParsing extends DateTimeOptions {
  /**
   * If the input is a Grafana quick date, e.g. now-6h, then you can specify this to control
   * whether the last part of the date and time value is included or excluded.
   *
   * Example: now-6h and the current time is 12:20:00 if roundUp is set to true
   * the returned DateTime value will be 06:00:00.
   */
  roundUp?: boolean;
  fiscalYearStartMonth?: number;
}

type DateTimeParser<T extends DateTimeOptions = DateTimeOptions> = (value: DateTimeInput, options?: T) => DateTime;

/**
 * Helper function to parse a number, text or Date to a DateTime value. If a timeZone is supplied the incoming value
 * is parsed with that timeZone as a base. The only exception to this is if the passed value is in a UTC-based
 * format. Then it will use UTC as the base. If no format is specified the current system format will be assumed.
 *
 * It can also parse the Grafana quick date and time format, e.g. now-6h will be parsed as Date.now() - 6 hours and
 * returned as a valid DateTime value.
 *
 * If no options are supplied, then default values are used. For more details please see {@link DateTimeOptions}.
 *
 * @param value - should be a parsable date and time value
 * @param options
 *
 * @public
 */
export const dateTimeParse: DateTimeParser<DateTimeOptionsWhenParsing> = (value, options?): DateTime => {
  if (isDateTime(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return parseString(value, options);
  }

  return parseOthers(value, options);
};

const parseString = (value: string, options?: DateTimeOptionsWhenParsing): DateTime => {
  if (value.indexOf('now') !== -1) {
    if (!isValid(value)) {
      return dateTime();
    }

    const parsed = parse(value, options?.roundUp, options?.timeZone, options?.fiscalYearStartMonth);
    return parsed || dateTime();
  }

  let timeZone = getTimeZone(options);
  let format = options?.format ?? systemDateFormats.fullDate;
  if (value.endsWith('Z')) {
    // This is a special case when we have an ISO date string
    // In this case we want to force the format to be ISO and the timeZone to be UTC
    // This logic is needed for initial load when parsing the URL params
    format = 'YYYY-MM-DDTHH:mm:ss.SSSZ';
    timeZone = 'utc';
  }

  const zone = moment.tz.zone(timeZone);

  if (zone && zone.name) {
    return dateTimeForTimeZone(zone.name, value, format);
  }

  switch (lowerCase(timeZone)) {
    case 'utc':
      return toUtc(value, format);
    default:
      return dateTime(value, format);
  }
};

const parseOthers = (value: DateTimeInput, options?: DateTimeOptionsWhenParsing): DateTime => {
  const date = value;
  const timeZone = getTimeZone(options);
  const zone = moment.tz.zone(timeZone);

  if (zone && zone.name) {
    return dateTimeForTimeZone(zone.name, date);
  }

  switch (lowerCase(timeZone)) {
    case 'utc':
      return toUtc(date);
    default:
      return dateTime(date);
  }
};
