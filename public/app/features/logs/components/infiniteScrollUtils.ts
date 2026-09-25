import { type MutableRefObject } from 'react';

import { type AbsoluteTimeRange, type LogRowModel, type TimeRange, rangeUtil } from '@grafana/data';
import { LogsSortOrder, type TimeZone } from '@grafana/schema';

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

export function getVisibleRange(rows: LogRowModel[]) {
  const firstTimeStamp = rows[0].timeEpochMs;
  const lastTimeStamp = rows[rows.length - 1].timeEpochMs;

  const visibleRange =
    lastTimeStamp < firstTimeStamp
      ? { from: lastTimeStamp, to: firstTimeStamp }
      : { from: firstTimeStamp, to: lastTimeStamp };

  return visibleRange;
}

function getPrevRange(visibleRange: AbsoluteTimeRange, currentRange: TimeRange) {
  return { from: currentRange.from.valueOf(), to: visibleRange.from };
}

function getNextRange(visibleRange: AbsoluteTimeRange, currentRange: TimeRange, timeZone: TimeZone) {
  currentRange = updateCurrentRange(currentRange, timeZone);
  return { from: visibleRange.to, to: currentRange.to.valueOf() };
}

export function canScrollTop(
  visibleRange: AbsoluteTimeRange,
  currentRange: TimeRange,
  timeZone: TimeZone,
  sortOrder: LogsSortOrder
): AbsoluteTimeRange | undefined {
  if (sortOrder === LogsSortOrder.Descending) {
    currentRange = updateCurrentRange(currentRange, timeZone);
    const canScroll = currentRange.to.valueOf() - visibleRange.to > SCROLLING_THRESHOLD;
    return canScroll ? getNextRange(visibleRange, currentRange, timeZone) : undefined;
  }

  const canScroll = Math.abs(currentRange.from.valueOf() - visibleRange.from) > SCROLLING_THRESHOLD;
  return canScroll ? getPrevRange(visibleRange, currentRange) : undefined;
}

export function canScrollBottom(
  visibleRange: AbsoluteTimeRange,
  currentRange: TimeRange,
  timeZone: TimeZone,
  sortOrder: LogsSortOrder
): AbsoluteTimeRange | undefined {
  if (sortOrder === LogsSortOrder.Descending) {
    const canScroll = Math.abs(currentRange.from.valueOf() - visibleRange.from) > SCROLLING_THRESHOLD;
    return canScroll ? getPrevRange(visibleRange, currentRange) : undefined;
  }
  currentRange = updateCurrentRange(currentRange, timeZone);
  const canScroll = currentRange.to.valueOf() - visibleRange.to > SCROLLING_THRESHOLD;
  return canScroll ? getNextRange(visibleRange, currentRange, timeZone) : undefined;
}

function updateCurrentRange(timeRange: TimeRange, timeZone: TimeZone) {
  return rangeUtil.isRelativeTimeRange(timeRange.raw)
    ? rangeUtil.convertRawToRange(timeRange.raw, timeZone)
    : timeRange;
}
