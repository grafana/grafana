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
  const formattedFrom = stringToDateTime(range.from).format(TIME_FORMAT);
  const formattedTo = stringToDateTime(range.to).format(TIME_FORMAT);
  const from = dateTimeToString(range.from);
  const to = dateTimeToString(range.to);

  return {
    from,
    to,
    section: 3,
    display: `${formattedFrom} to ${formattedTo}`,
  };
};

export const mapStringsToTimeRange = (from: string, to: string, roundup?: boolean, timeZone?: TimeZone): TimeRange => {
  const fromDate = stringToDateTimeType(from, roundup, timeZone);
  const toDate = stringToDateTimeType(to, roundup, timeZone);

  if (from.indexOf('now') !== -1 || to.indexOf('now') !== -1) {
    return {
      from: fromDate,
      to: toDate,
      raw: {
        from,
        to,
      },
    };
  }

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
