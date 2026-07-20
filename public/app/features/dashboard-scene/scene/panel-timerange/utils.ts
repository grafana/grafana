import { dateTime, type DateTime, rangeUtil, type TimeRange } from '@grafana/data';

import type { PanelTimeRangeState } from './PanelTimeRange';

/**
 * Whether a panel should use a hover header, used when there's
 * nothing always-visible to display in it (no title, no visible time override).
 * return true hides the header, return false displays the header
 */
export function getUpdatedHoverHeader(title: string, timeOverride?: Partial<PanelTimeRangeState>): boolean {
  if (title !== '') {
    return false;
  }

  if (timeOverride && !timeOverride.hideTimeOverride) {
    if (timeOverride.timeFrom || timeOverride.timeShift || timeOverride.compareWith) {
      return false;
    }
  }

  return true;
}

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
