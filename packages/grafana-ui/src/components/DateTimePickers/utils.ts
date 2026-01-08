import { dateMath, dateTimeParse, isDateTime, TimeRange, TimeZone } from '@grafana/data';

import { commonFormat } from './commonFormat';

export function isValid(value: string, roundUp?: boolean, timeZone?: TimeZone): boolean {
  if (isDateTime(value)) {
    return value.isValid();
  }

  // handles `now` math
  if (dateMath.isMathString(value)) {
    return dateMath.isValid(value);
  }

  const parsed = dateTimeParse(value, { roundUp, timeZone, format: commonFormat });
  return parsed.isValid();
}

export function isValidTimeRange(range: TimeRange) {
  return dateMath.isValid(range.from) && dateMath.isValid(range.to);
}
