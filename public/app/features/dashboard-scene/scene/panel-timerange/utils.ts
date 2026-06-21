import { map } from 'rxjs';

import { dateTime, type DateTime, rangeUtil, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  type ExtraQueryDataProcessor,
  getCompareSeriesRefId,
  timeShiftAlignmentProcessor as scenesTimeShiftAlignmentProcessor,
} from '@grafana/scenes';

import type { PanelTimeRangeState } from './PanelTimeRange';

export const timeShiftAlignmentProcessor: ExtraQueryDataProcessor = (primary, secondary) => {
  if (primary.series.every((frame) => frame.length === 0) || secondary.series.some((frame) => frame.length > 0)) {
    return scenesTimeShiftAlignmentProcessor(primary, secondary);
  }

  const targetFrames = secondary.request?.targets.map((target) => ({
    refId: getCompareSeriesRefId(target.refId),
    fields: [],
    length: 0,
  }));
  const series = secondary.series.length
    ? secondary.series
    : targetFrames?.length
      ? targetFrames
      : [{ fields: [], length: 0 }];
  const notice = {
    severity: 'info' as const,
    text: t('dashboard.time-compare.no-data-notice', 'No data returned for time comparison'),
  };

  return scenesTimeShiftAlignmentProcessor(primary, { ...secondary, series }).pipe(
    map((result) => ({
      ...result,
      series: result.series.map((frame) => ({
        ...frame,
        meta: {
          ...frame.meta,
          notices: [...(frame.meta?.notices ?? []), notice],
        },
      })),
    }))
  );
};

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
