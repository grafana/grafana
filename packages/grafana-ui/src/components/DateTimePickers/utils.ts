import { dateMath, dateTimeParse, isDateTime, type TimeRange, type TimeZone } from '@grafana/data';

import { commonFormat } from './commonFormat';

export function isValid(value: string, roundUp?: boolean, timeZone?: TimeZone): boolean {
  if (isDateTime(value)) {
    return value.isValid();
  }

  // handles `now` math AND ISO week logic
  // dateMath.isValid calls dateMath.parse internally!
  if (dateMath.isValid(value)) {
    return true;
  }

  const parsed = dateTimeParse(value, { roundUp, timeZone, format: commonFormat });
  return parsed.isValid();
}

export function isValidTimeRange(range: TimeRange) {
  return dateMath.isValid(range.from) && dateMath.isValid(range.to);
}
