import {
  TimeRange,
  TIME_FORMAT,
  RawTimeRange,
  TimeZone,
  rangeUtil,
  dateMath,
  isDateTime,
  dateTime,
  DateTime,
  toUtc,
} from '@grafana/data';

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
  return rangeUtil.describeTimeRange(timeRange);
};

export const isValidTimeString = (text: string) => dateMath.isValid(text);
