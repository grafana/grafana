import {
  type TimeOption,
  type TimeRange,
  type TimeZone,
  rangeUtil,
  dateTimeFormat,
  formatTimeWithNanos,
} from '@grafana/data';

/**
 * Takes a printable TimeOption and builds a TimeRange with DateTime properties from it
 */
export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone);
};

/**
 * Takes a TimeRange and makes a printable TimeOption with formatted date strings correct for the timezone from it
 */
export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const hasNanos = Boolean(range.fromNano || range.toNano);
  const from = hasNanos
    ? formatTimeWithNanos(range.from, range.fromNano, timeZone)
    : dateTimeFormat(range.from, { timeZone });
  const to = hasNanos ? formatTimeWithNanos(range.to, range.toNano, timeZone) : dateTimeFormat(range.to, { timeZone });

  return {
    from,
    to,
    display: `${from} to ${to}`,
  };
};
