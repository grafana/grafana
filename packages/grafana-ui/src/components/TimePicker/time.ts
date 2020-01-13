import { TimeRange, TIME_FORMAT, RawTimeRange, TimeZone } from '@grafana/data';
import { DateTime, isDateTime, dateMath, dateTime, dateTimeForTimeZone, rangeUtil } from '@grafana/data/src/datetime';

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

  return dateTimeForTimeZone(timeZone, value, TIME_FORMAT);
};

export const mapTimeRangeToRangeString = (timeRange: RawTimeRange): string => {
  return rangeUtil.describeTimeRange(timeRange);
};

export const isValidTimeString = (text: string) => dateMath.isValid(text);
