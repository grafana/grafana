import { TimeRange, TIME_FORMAT, RawTimeRange, TimeZone } from '../../types/time';
import { describeTimeRange } from '../../utils/rangeutil';
import * as dateMath from '../../utils/datemath';
import { isDateTime, dateTime, DateTime, toUtc } from '../../utils/moment_wrapper';

export const rawToTimeRange = (raw: RawTimeRange, timeZone?: TimeZone): TimeRange => {
  const from = stringToDateTimeType(raw.from, false, timeZone);
  const to = stringToDateTimeType(raw.to, true, timeZone);

  return { from, to, raw };
};

export const stringToDateTimeType = (value: string | DateTime, roundUp?: boolean, timeZone?: TimeZone): DateTime => {
  if (isDateTime(value)) {
    return value;
  }

  if (value.indexOf('now') !== -1) {
    if (!dateMath.isValid(value)) {
      return dateTime();
    }

    const parsed = dateMath.parse(value, roundUp, timeZone);
    return parsed || dateTime();
  }

  if (timeZone === 'utc') {
    return toUtc(value, TIME_FORMAT);
  }

  return dateTime(value, TIME_FORMAT);
};

export const mapTimeRangeToRangeString = (timeRange: RawTimeRange): string => {
  return describeTimeRange(timeRange);
};

export const isValidTimeString = (text: string) => dateMath.isValid(text);
