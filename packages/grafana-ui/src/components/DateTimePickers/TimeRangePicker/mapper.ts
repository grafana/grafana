import { type TimeOption, type TimeRange, type TimeZone, rangeUtil } from '@grafana/data';

import { formatWithOptionalMs } from '../utils';

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
  const from = formatWithOptionalMs(range.from, timeZone);
  const to = formatWithOptionalMs(range.to, timeZone);

  return {
    from,
    to,
    display: `${from} to ${to}`,
  };
};
