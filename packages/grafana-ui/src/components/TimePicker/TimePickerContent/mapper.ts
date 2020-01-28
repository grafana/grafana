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

export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return {
    from: stringToDateTime(option.from, false, timeZone),
    to: stringToDateTime(option.to, true, timeZone),
    raw: {
      from: option.from,
      to: option.to,
    },
  };
};

export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const formattedFrom = stringToDateTime(range.from, false, timeZone).format(TIME_FORMAT);
  const formattedTo = stringToDateTime(range.to, true, timeZone).format(TIME_FORMAT);
  const from = dateTimeToString(range.from, timeZone);
  const to = dateTimeToString(range.to, timeZone);

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

  if (dateMath.isMathString(from) || dateMath.isMathString(to)) {
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
    if (timeZone === 'utc') {
      return value.utc();
    }
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

const dateTimeToString = (value: DateTime, timeZone?: TimeZone): string => {
  if (!isDateTime(value)) {
    return value;
  }

  const isUtc = timeZone === 'utc';
  if (isUtc) {
    return value.utc().format(TIME_FORMAT);
  }

  return value.format(TIME_FORMAT);
};
