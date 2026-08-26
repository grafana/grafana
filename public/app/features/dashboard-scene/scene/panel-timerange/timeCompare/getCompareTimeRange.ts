import { dateTime, type DateTime, rangeUtil, type TimeRange } from '@grafana/data';

import { PREVIOUS_PERIOD_VALUE } from './options';

/**
 * Shifts a panel's time range backwards to produce the comparison window.
 * Returns undefined when time comparison is off.
 */
export function getCompareTimeRange(timeRange: TimeRange, compareWith: string | undefined): TimeRange | undefined {
  if (!compareWith) {
    return undefined;
  }

  let compareFrom: DateTime;
  let compareTo: DateTime;
  let shift: string;

  if (compareWith === PREVIOUS_PERIOD_VALUE) {
    const diffMs = timeRange.to.diff(timeRange.from);
    compareFrom = dateTime(timeRange.from!).subtract(diffMs);
    compareTo = dateTime(timeRange.to!).subtract(diffMs);
    shift = '-' + rangeUtil.secondsToHms(diffMs / 1000);
  } else {
    compareFrom = dateTime(timeRange.from!).subtract(rangeUtil.intervalToMs(compareWith));
    compareTo = dateTime(timeRange.to!).subtract(rangeUtil.intervalToMs(compareWith));
    shift = '-' + compareWith;
  }

  if (rangeUtil.isRelativeTimeRange(timeRange.raw)) {
    const rawFrom = typeof timeRange.raw.from === 'string' ? `${timeRange.raw.from}${shift}` : compareFrom;
    const rawTo = typeof timeRange.raw.to === 'string' ? `${timeRange.raw.to}${shift}` : compareTo;

    return {
      from: compareFrom,
      to: compareTo,
      raw: { from: rawFrom, to: rawTo },
    };
  }

  return {
    from: compareFrom,
    to: compareTo,
    raw: {
      from: compareFrom,
      to: compareTo,
    },
  };
}
