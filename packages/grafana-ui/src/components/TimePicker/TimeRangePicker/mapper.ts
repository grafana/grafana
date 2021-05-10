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

const displayUnits: Record<string, string> = {
  s: 'second',
  m: 'minute',
  h: 'hour',
  y: 'year',
  w: 'week',
  d: 'day',
  ms: 'millisecond',
};

export const mapRelativeTimeRangeToOption = (range: RelativeTimeRange): TimeOption => {
  const from = rangeUtil.secondsToHighestUnit(range.from);
  const to = rangeUtil.secondsToHighestUnit(range.to);

  if (!from) {
    return {
      from: 'now-6h',
      to: 'now',
      display: `${formatToOptionDisplay({ value: 6, unit: 'h' })}`,
    };
  }

  if (!to) {
    return {
      from: formatToOptionValue(from),
      to: 'now',
      display: formatToOptionDisplay(from),
    };
  }

  return {
    from: formatToOptionValue(from),
    to: formatToOptionValue(to),
    display: `${formatToOptionDisplay(from)}, ${formatToOptionDisplay(to)}`,
  };
};

const formatToOptionDisplay = (value: rangeUtil.HighestUnitValue): string => {
  const suffix = value.value > 0 ? 's' : '';
  return `${value.value} ${displayUnits[value.unit]}${suffix}`;
};

const formatToOptionValue = (value: rangeUtil.HighestUnitValue): string => {
  return `now-${value.value}${value.unit}`;
};
