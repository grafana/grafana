import { type MutableRefObject } from 'react';

import { type AbsoluteTimeRange, type LogRowModel, type TimeRange, rangeUtil } from '@grafana/data';
import { type DataQuery, LogsSortOrder, type TimeZone } from '@grafana/schema';

export enum ScrollDirection {
  Top = -1,
  Bottom = 1,
  NoScroll = 0,
}

export const SCROLLING_THRESHOLD = 1e3;

export function shouldLoadMore(
  event: Event | WheelEvent,
  lastEvent: Event | WheelEvent | null,
  countRef: MutableRefObject<number>,
  element: HTMLDivElement,
  lastScroll: number
): ScrollDirection {
  const delta = event instanceof WheelEvent ? event.deltaY : element.scrollTop - lastScroll;
  if (delta === 0) {
    return ScrollDirection.NoScroll;
  }

  const scrollDirection = delta < 0 ? ScrollDirection.Top : ScrollDirection.Bottom;
  const diff =
    scrollDirection === ScrollDirection.Top
      ? element.scrollTop
      : element.scrollHeight - element.scrollTop - element.clientHeight;

  if (diff > 1) {
    return ScrollDirection.NoScroll;
  }

  if (!lastEvent || shouldIgnoreChainOfEvents(event, lastEvent, countRef)) {
    return ScrollDirection.NoScroll;
  }

  return scrollDirection;
}

function shouldIgnoreChainOfEvents(
  event: Event | WheelEvent,
  lastEvent: Event | WheelEvent,
  countRef: MutableRefObject<number>
) {
  const deltaTime = event.timeStamp - lastEvent.timeStamp;
  if (deltaTime > 500) {
    countRef.current = 0;
    return false;
  }
  countRef.current++;
  if (deltaTime < 100) {
    if (countRef.current >= 180) {
      countRef.current = 0;
      return false;
    }
    return true;
  }
  if (deltaTime < 400) {
    if (countRef.current >= 25) {
      countRef.current = 0;
      return false;
    }
  }
  return true;
}

/** Millisecond window plus the oldest and newest rows by nanosecond timestamp. */
export interface VisibleLogsRange extends AbsoluteTimeRange {
  oldestNs: string;
  newestNs: string;
}

/**
 * Millisecond range infinite scroll already sends, plus one Loki nanosecond bound.
 * The unused side is omitted so that edge stays the dashboard range.
 */
export interface LogsNanoSecondTimeRange extends AbsoluteTimeRange {
  startNs?: string;
  endNs?: string;
}

export function getVisibleRange(rows: LogRowModel[]): VisibleLogsRange {
  const firstTimeStamp = rows[0].timeEpochMs;
  const lastTimeStamp = rows[rows.length - 1].timeEpochMs;

  let oldestNs = rows[0].timeEpochNs;
  let newestNs = rows[0].timeEpochNs;
  for (let i = 1; i < rows.length; i++) {
    const ns = rows[i].timeEpochNs;
    // Several rows can share a millisecond, and timeEpochMs does not order those.
    if (BigInt(ns) < BigInt(oldestNs)) {
      oldestNs = ns;
    }
    if (BigInt(ns) > BigInt(newestNs)) {
      newestNs = ns;
    }
  }

  const visibleRange =
    lastTimeStamp < firstTimeStamp
      ? { from: lastTimeStamp, to: firstTimeStamp, oldestNs, newestNs }
      : { from: firstTimeStamp, to: lastTimeStamp, oldestNs, newestNs };

  return visibleRange;
}

function getPrevRange(visibleRange: VisibleLogsRange, currentRange: TimeRange): LogsNanoSecondTimeRange {
  // Loki's end is exclusive, so this line is not returned again and older lines in the same millisecond are.
  return { from: currentRange.from.valueOf(), to: visibleRange.from, endNs: visibleRange.oldestNs };
}

function getNextRange(
  visibleRange: VisibleLogsRange,
  currentRange: TimeRange,
  timeZone: TimeZone
): LogsNanoSecondTimeRange {
  currentRange = updateCurrentRange(currentRange, timeZone);
  // Loki's start is inclusive, so begin one nanosecond after the newest visible line.
  return {
    from: visibleRange.to,
    to: currentRange.to.valueOf(),
    startNs: (BigInt(visibleRange.newestNs) + BigInt(1)).toString(),
  };
}

export function canScrollTop(
  visibleRange: VisibleLogsRange,
  currentRange: TimeRange,
  timeZone: TimeZone,
  sortOrder: LogsSortOrder
): LogsNanoSecondTimeRange | undefined {
  if (sortOrder === LogsSortOrder.Descending) {
    currentRange = updateCurrentRange(currentRange, timeZone);
    const canScroll = currentRange.to.valueOf() - visibleRange.to > SCROLLING_THRESHOLD;
    return canScroll ? getNextRange(visibleRange, currentRange, timeZone) : undefined;
  }

  const canScroll = Math.abs(currentRange.from.valueOf() - visibleRange.from) > SCROLLING_THRESHOLD;
  return canScroll ? getPrevRange(visibleRange, currentRange) : undefined;
}

export function canScrollBottom(
  visibleRange: VisibleLogsRange,
  currentRange: TimeRange,
  timeZone: TimeZone,
  sortOrder: LogsSortOrder
): LogsNanoSecondTimeRange | undefined {
  if (sortOrder === LogsSortOrder.Descending) {
    const canScroll = Math.abs(currentRange.from.valueOf() - visibleRange.from) > SCROLLING_THRESHOLD;
    return canScroll ? getPrevRange(visibleRange, currentRange) : undefined;
  }
  currentRange = updateCurrentRange(currentRange, timeZone);
  const canScroll = currentRange.to.valueOf() - visibleRange.to > SCROLLING_THRESHOLD;
  return canScroll ? getNextRange(visibleRange, currentRange, timeZone) : undefined;
}

/** Used when unlimited scrolling continues past the dashboard interval. Keeps the visible millisecond window and one bound. */
export function loadMoreRangeFromVisible(
  visibleRange: VisibleLogsRange,
  scrollDirection: ScrollDirection,
  sortOrder: LogsSortOrder
): LogsNanoSecondTimeRange {
  const loadingOlder =
    sortOrder === LogsSortOrder.Descending
      ? scrollDirection === ScrollDirection.Bottom
      : scrollDirection === ScrollDirection.Top;
  if (loadingOlder) {
    return { from: visibleRange.from, to: visibleRange.to, endNs: visibleRange.oldestNs };
  }
  return {
    from: visibleRange.from,
    to: visibleRange.to,
    startNs: (BigInt(visibleRange.newestNs) + BigInt(1)).toString(),
  };
}

function updateCurrentRange(timeRange: TimeRange, timeZone: TimeZone) {
  return rangeUtil.isRelativeTimeRange(timeRange.raw)
    ? rangeUtil.convertRawToRange(timeRange.raw, timeZone)
    : timeRange;
}

/** Copies the single nanosecond bound onto a Loki query. Other datasources are unchanged. */
export function withLokiNsBound<T extends DataQuery & { supportingQueryType?: string }>(
  query: T,
  nanoSecondTimeRange: LogsNanoSecondTimeRange,
  datasourceType?: string
): T & { startNs?: string; endNs?: string } {
  const configured = query.datasource;
  const configuredType =
    configured && typeof configured === 'object' && 'type' in configured ? configured.type : undefined;
  if ((typeof configuredType === 'string' ? configuredType : datasourceType) !== 'loki') {
    return query;
  }
  if (nanoSecondTimeRange.endNs !== undefined) {
    return { ...query, endNs: nanoSecondTimeRange.endNs };
  }
  if (nanoSecondTimeRange.startNs !== undefined) {
    return { ...query, startNs: nanoSecondTimeRange.startNs };
  }
  return query;
}
