/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import moment, { MomentInput } from 'moment-timezone';
import { DateTimeInput, DateTime, isDateTime, toUtc } from './moment_wrapper';
import { DateTimeOptions, getTimeZone } from './common';
import { parse, isValid } from './datemath';
import { lowerCase } from 'lodash';

export interface DateTimeOptionsWhenParsing extends DateTimeOptions {
  roundUp?: boolean;
}

export type DateTimeParser<T extends DateTimeOptions = DateTimeOptions> = (
  value: DateTimeInput,
  options?: T
) => DateTime;

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
      return toUtc();
    }

    const parsed = parse(value, options?.roundUp, options?.timeZone);
    return parsed || toUtc();
  }

  return parseOthers(value, options);
};

const parseOthers = (value: DateTimeInput, options?: DateTimeOptionsWhenParsing): DateTime => {
  const date = value as MomentInput;
  const timeZone = getTimeZone(options);
  const zone = moment.tz.zone(timeZone);

  if (zone && zone.name) {
    return moment.tz(date, zone.name) as DateTime;
  }

  switch (lowerCase(timeZone)) {
    case 'utc':
      return moment.utc(date) as DateTime;
    default:
      return moment(date) as DateTime;
  }
};
