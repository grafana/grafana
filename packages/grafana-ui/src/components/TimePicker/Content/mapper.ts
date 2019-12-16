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

export const mapToTimeRange = (option: TimeOption): TimeRange => {
  return {
    from: stringToDateTime(option.from),
    to: stringToDateTime(option.to),
    raw: {
      from: option.from,
      to: option.to,
    },
  };
};

export const mapToTimeOption = (range: TimeRange): TimeOption => {
  const from = dateTimeToString(range.from);
  const to = dateTimeToString(range.to);

  return {
    from,
    to,
    section: 3,
    display: `${from} to ${to}`,
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
