import {
  TimeOption,
  TimeRange,
  isDateTime,
  DateTime,
  TimeZone,
  dateMath,
  dateTime,
  dateTimeForTimeZone,
  TIME_FORMAT,
} from '@grafana/data';
import { stringToDateTimeType } from '../time';

export const mapOptionToTimeRange = (option: TimeOption): TimeRange => {
  return {
    from: stringToDateTime(option.from),
    to: stringToDateTime(option.to),
    raw: {
      from: option.from,
      to: option.to,
    },
  };
};

export const mapRangeToTimeOption = (range: TimeRange): TimeOption => {
  const from = dateTimeToString(range.from);
  const to = dateTimeToString(range.to);

  return {
    from,
    to,
    section: 3,
    display: `${from} to ${to}`,
  };
};

export const mapStringsToTimeRange = (from: string, to: string): TimeRange => {
  const fromDate = stringToDateTimeType(from);
  const toDate = stringToDateTimeType(to);

  return {
    from: fromDate,
    to: toDate,
    raw: {
      from: fromDate,
      to: toDate,
    },
  };
};

const stringToDateTime = (value: string | DateTime, roundUp?: boolean, timeZone?: TimeZone): DateTime => {
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

const dateTimeToString = (value: DateTime): string => {
  if (isDateTime(value)) {
    return value.format(TIME_FORMAT);
  }
  return value;
};
