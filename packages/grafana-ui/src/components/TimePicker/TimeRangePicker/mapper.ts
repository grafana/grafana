import {
  dateMath,
  dateTime,
  TimeOption,
  TimeRange,
  TimeZone,
  rangeUtil,
  dateTimeFormat,
  RelativeTimeRange,
} from '@grafana/data';

export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone);
};

export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const from = dateTimeFormat(range.from, { timeZone });
  const to = dateTimeFormat(range.to, { timeZone });

  return {
    from,
    to,
    display: `${from} to ${to}`,
  };
};

export const mapOptionToRelativeTimeRange = (option: TimeOption): RelativeTimeRange | undefined => {
  const now = dateTime().unix();
  const from = dateMath.parse(option.from)?.unix();
  const to = dateMath.parse(option.to)?.unix();
  if (!from || !to) {
    return;
  }

  return {
    from: now - from,
    to: now - to,
  };
};

export const mapRelativeTimeRangeToOption = (relativeTimeRage: RelativeTimeRange): TimeOption => {
  return {
    from: `now-${relativeTimeRage.from}s`,
    to: relativeTimeRage.to > 0 ? `now-${relativeTimeRage.to}s` : 'now',
    display: 'something readable',
  };
};
