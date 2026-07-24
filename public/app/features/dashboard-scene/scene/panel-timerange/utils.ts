// Processor function for use with time shifted comparison series.
// This aligns the secondary series with the primary and adds custom
// metadata and config to the secondary series' fields so that it is

import { of } from 'rxjs';

import { dateTime, type DataFrame, type DateTime, rangeUtil, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type ExtraQueryDataProcessor } from '@grafana/scenes';

import type { PanelTimeRangeState } from './PanelTimeRange';

// rendered appropriately.
export const timeShiftAlignmentProcessor: ExtraQueryDataProcessor = (primary, secondary) => {
  const diff = secondary.timeRange.from.diff(primary.timeRange.from);
  // Data sources signal "no data" either by returning no frames at all or by returning empty frames.
  if (secondary.series.every((series) => series.length === 0) && primary.series.some((series) => series.length > 0)) {
    const refIds = secondary.series.length
      ? secondary.series.map((series) => series.refId)
      : secondary.request?.targets.map((target) => target.refId);
    secondary.series = getTimeCompareNoDataFrames(diff, refIds);
    return of(secondary);
  }

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

export const getCompareSeriesRefId = (refId: string) => (refId.endsWith('-compare') ? refId : `${refId}-compare`);

function getTimeCompareNoDataFrames(diffMs: number, refIds: Array<string | undefined> = []): DataFrame[] {
  const frameRefIds = refIds.length ? refIds : [undefined];

  return frameRefIds.map((refId) => ({
    refId: getCompareSeriesRefId(refId ?? ''),
    fields: [],
    length: 0,
    meta: {
      notices: [
        {
          severity: 'info',
          text: t('dashboard.time-compare.no-data-notice', 'No data returned for time comparison'),
        },
      ],
      timeCompare: {
        diffMs,
        isTimeShiftQuery: true,
      },
    },
  }));
}

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
