// Processor function for use with time shifted comparison series.
// This aligns the secondary series with the primary and adds custom
// metadata and config to the secondary series' fields so that it is

import { of } from 'rxjs';

import { dateTime, DateTime, rangeUtil, TimeRange } from '@grafana/data';
import { ExtraQueryDataProcessor } from '@grafana/scenes';

// rendered appropriately.
export const timeShiftAlignmentProcessor: ExtraQueryDataProcessor = (primary, secondary) => {
  const diff = secondary.timeRange.from.diff(primary.timeRange.from);
  secondary.series.forEach((series) => {
    series.refId = getCompareSeriesRefId(series.refId || '');
    series.meta = {
      ...series.meta,
      // @ts-ignore Remove when https://github.com/grafana/grafana/pull/71129 is released
      timeCompare: {
        diffMs: diff,
        isTimeShiftQuery: true,
      },
    };
  });
  return of(secondary);
};

export const getCompareSeriesRefId = (refId: string) => `${refId}-compare`;

const PREVIOUS_PERIOD_VALUE = '__previousPeriod';

export function getCompareTimeRange(timeRange: TimeRange, compareWith: string | undefined): TimeRange | undefined {
  let compareFrom: DateTime;
  let compareTo: DateTime;

  if (compareWith) {
    if (compareWith === PREVIOUS_PERIOD_VALUE) {
      const diffMs = timeRange.to.diff(timeRange.from);
      compareFrom = dateTime(timeRange.from!).subtract(diffMs);
      compareTo = dateTime(timeRange.to!).subtract(diffMs);
    } else {
      compareFrom = dateTime(timeRange.from!).subtract(rangeUtil.intervalToMs(compareWith));
      compareTo = dateTime(timeRange.to!).subtract(rangeUtil.intervalToMs(compareWith));
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

  return undefined;
}
