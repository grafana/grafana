import { type TimeOption, type TimeRange, type TimeZone, rangeUtil } from '@grafana/data';

import { formatWithOptionalMs } from '../utils';

/**
 * Takes a printable TimeOption and builds a TimeRange with DateTime properties from it
 */
export const mapOptionToTimeRange = (option: TimeOption, timeZone?: TimeZone): TimeRange => {
  return rangeUtil.convertRawToRange({ from: option.from, to: option.to }, timeZone);
};

export const mapRangeToTimeOption = (range: TimeRange, timeZone?: TimeZone): TimeOption => {
  const fromLabel = formatWithOptionalMs(range.from, timeZone, range);
  const toLabel = formatWithOptionalMs(range.to, timeZone, range);

  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    display: `${fromLabel} to ${toLabel}`,
  };
};
