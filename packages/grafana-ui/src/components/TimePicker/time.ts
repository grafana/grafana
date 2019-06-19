import { TimeOption, TimeRange, TIME_FORMAT, RawTimeRange, TimeZone } from '../../types/time';
import { describeTimeRange } from '../../utils/rangeutil';
import * as dateMath from '../../utils/datemath';
import { dateTime, DateTime, toUtc } from '../../utils/moment_wrapper';

export const mapTimeOptionToTimeRange = (timeOption: TimeOption, timeZone?: TimeZone): TimeRange => {
  const fromMoment = stringToDateTimeType(timeOption.from, false, timeZone);
  const toMoment = stringToDateTimeType(timeOption.to, true, timeZone);

  return {
    from: fromMoment,
    to: toMoment,
    raw: {
      from: timeOption.from,
      to: timeOption.to,
    },
  };
};

export const stringToDateTimeType = (value: string, roundUp?: boolean, timeZone?: TimeZone): DateTime => {
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
