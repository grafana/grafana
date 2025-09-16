import { css } from '@emotion/css';
import { ReactNode, MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

import { AbsoluteTimeRange, CoreApp, LogRowModel, TimeRange, rangeUtil } from '@grafana/data';
// import { convertRawToRange, isRelativeTime, isRelativeTimeRange } from '@grafana/data/internal';
import { Trans } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { LogsSortOrder, TimeZone } from '@grafana/schema';
import { Button, Icon } from '@grafana/ui';

import { LoadingIndicator } from './LoadingIndicator';

export type Props = {
  app?: CoreApp;
  children: ReactNode;
  loading: boolean;
  loadMoreLogs?: (range: AbsoluteTimeRange) => void;
  range: TimeRange;
  rows: LogRowModel[];
  scrollElement: HTMLDivElement | null;
  sortOrder: LogsSortOrder;
  timeZone: TimeZone;
  topScrollEnabled?: boolean;
};

export const InfiniteScroll = ({
  app,
  children,
  loading,
  loadMoreLogs,
  range,
  rows,
  scrollElement,
  sortOrder,
  timeZone,
  topScrollEnabled = false,
}: Props) => {
  const [upperOutOfRange, setUpperOutOfRange] = useState(false);
  const [lowerOutOfRange, setLowerOutOfRange] = useState(false);
  const [upperLoading, setUpperLoading] = useState(false);
  const [lowerLoading, setLowerLoading] = useState(false);
  const rowsRef = useRef<LogRowModel[]>(rows);
  const lastScroll = useRef<number>(scrollElement?.scrollTop || 0);
  const lastEvent = useRef<Event | WheelEvent | null>(null);
  const countRef = useRef(0);

  // Reset messages when range/order/rows change
  useEffect(() => {
    setUpperOutOfRange(false);
    setLowerOutOfRange(false);
  }, [range, rows, sortOrder]);

  // Reset loading messages when loading stops
  useEffect(() => {
    if (!loading) {
      setUpperLoading(false);
      setLowerLoading(false);
    }
  }, [loading]);

  // Ensure bottom loader visibility
  useEffect(() => {
    if (lowerLoading && scrollElement) {
      scrollElement.scrollTo(0, scrollElement.scrollHeight - scrollElement.clientHeight);
    }
  }, [lowerLoading, scrollElement]);

  // Request came back with no new past rows
  useEffect(() => {
    if (rows !== rowsRef.current && rows.length === rowsRef.current.length && (upperLoading || lowerLoading)) {
      if (sortOrder === LogsSortOrder.Descending && lowerLoading) {
        setLowerOutOfRange(true);
      } else if (sortOrder === LogsSortOrder.Ascending && upperLoading) {
        setUpperOutOfRange(true);
      }
    }
    rowsRef.current = rows;
  }, [lowerLoading, rows, sortOrder, upperLoading]);

  useEffect(() => {
    if (!scrollElement || !loadMoreLogs) {
      return;
    }
    if (scrollElement.scrollHeight <= scrollElement.clientHeight) {
      return;
    }

    function handleScroll(event: Event | WheelEvent) {
      if (!scrollElement || !loadMoreLogs || !rows.length || loading || !config.featureToggles.logsInfiniteScrolling) {
        return;
      }
      const scrollDirection = shouldLoadMore(event, lastEvent.current, countRef, scrollElement, lastScroll.current);
      lastEvent.current = event;
      lastScroll.current = scrollElement.scrollTop;
      if (scrollDirection === ScrollDirection.NoScroll) {
        return;
      }
      event.stopImmediatePropagation();
      if (scrollDirection === ScrollDirection.Top && topScrollEnabled) {
        scrollTop();
      } else if (scrollDirection === ScrollDirection.Bottom) {
        scrollBottom();
      }
      lastEvent.current = null;
    }

    function scrollTop() {
      const newRange = canScrollTop(getVisibleRange(rows), range, timeZone, sortOrder);
      if (!newRange) {
        setUpperOutOfRange(true);
        return;
      }
      setUpperOutOfRange(false);
      loadMoreLogs?.(newRange);
      setUpperLoading(true);
      reportInteraction('grafana_logs_infinite_scrolling', {
        direction: 'top',
        sort_order: sortOrder,
      });
    }

    function scrollBottom() {
      const newRange = canScrollBottom(getVisibleRange(rows), range, timeZone, sortOrder);
      if (!newRange) {
        setLowerOutOfRange(true);
        return;
      }
      setLowerOutOfRange(false);
      loadMoreLogs?.(newRange);
      setLowerLoading(true);
      reportInteraction('grafana_logs_infinite_scrolling', {
        direction: 'bottom',
        sort_order: sortOrder,
      });
    }

    scrollElement.addEventListener('scroll', handleScroll);
    scrollElement.addEventListener('wheel', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('wheel', handleScroll);
    };
  }, [loadMoreLogs, loading, range, rows, scrollElement, sortOrder, timeZone, topScrollEnabled]);

  // We allow "now" to move when using relative time, so we hide the message so it doesn't flash.
  const hideTopMessage = sortOrder === LogsSortOrder.Descending && rangeUtil.isRelativeTime(range.raw.to);
  const hideBottomMessage = sortOrder === LogsSortOrder.Ascending && rangeUtil.isRelativeTime(range.raw.to);

  const loadOlderLogs = useCallback(() => {
    //If we are not on the last page, use next page's range
    reportInteraction('grafana_explore_logs_infinite_pagination_clicked', {
      pageType: 'olderLogsButton',
    });
    const newRange = canScrollTop(getVisibleRange(rows), range, timeZone, sortOrder);
    if (!newRange) {
      setUpperOutOfRange(true);
      return;
    }
    setUpperOutOfRange(false);
    loadMoreLogs?.(newRange);
    setUpperLoading(true);
    scrollElement?.scroll({
      behavior: 'auto',
      top: 0,
    });
  }, [loadMoreLogs, range, rows, scrollElement, sortOrder, timeZone]);

  return (
    <>
      {upperLoading && <LoadingIndicator adjective={sortOrder === LogsSortOrder.Descending ? 'newer' : 'older'} />}
      {!hideTopMessage && upperOutOfRange && outOfRangeMessage}
      {sortOrder === LogsSortOrder.Ascending && app === CoreApp.Explore && loadMoreLogs && (
        <Button className={styles.navButton} variant="secondary" onClick={loadOlderLogs} disabled={loading}>
          <div className={styles.navButtonContent}>
            <Icon name="angle-up" size="lg" />
            <Trans i18nKey="logs.infinite-scroll.older-logs">Older logs</Trans>
          </div>
        </Button>
      )}
      {children}
      {!hideBottomMessage && lowerOutOfRange && outOfRangeMessage}
      {lowerLoading && <LoadingIndicator adjective={sortOrder === LogsSortOrder.Descending ? 'older' : 'newer'} />}
    </>
  );
};

const styles = {
  messageContainer: css({
    textAlign: 'center',
    padding: 0.25,
  }),
  navButton: css({
    width: '58px',
    height: '68px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    lineHeight: '1',
    position: 'absolute',
    top: 0,
    right: -3,
    zIndex: 1,
  }),
  navButtonContent: css({
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    whiteSpace: 'normal',
  }),
};

const outOfRangeMessage = (
  <div className={styles.messageContainer} data-testid="end-of-range">
    <Trans i18nKey="logs.out-of-range-message.end-of-the-selected-time-range">End of the selected time range.</Trans>
  </div>
);

export enum ScrollDirection {
  Top = -1,
  Bottom = 1,
  NoScroll = 0,
}
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
  // Not a chain of events
  if (deltaTime > 500) {
    countRef.current = 0;
    return false;
  }
  countRef.current++;
  // Likely trackpad
  if (deltaTime < 100) {
    // User likely to want more results
    if (countRef.current >= 180) {
      countRef.current = 0;
      return false;
    }
    return true;
  }
  // Likely mouse wheel
  if (deltaTime < 400) {
    // User likely to want more results
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
  // When requesting new logs, update the current range if using relative time ranges.
  currentRange = updateCurrentRange(currentRange, timeZone);
  return { from: visibleRange.to, to: currentRange.to.valueOf() };
}

export const SCROLLING_THRESHOLD = 1e3;

// To get more logs, the difference between the visible range and the current range should be 1 second or more.
export function canScrollTop(
  visibleRange: AbsoluteTimeRange,
  currentRange: TimeRange,
  timeZone: TimeZone,
  sortOrder: LogsSortOrder
): AbsoluteTimeRange | undefined {
  if (sortOrder === LogsSortOrder.Descending) {
    // When requesting new logs, update the current range if using relative time ranges.
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
  // When requesting new logs, update the current range if using relative time ranges.
  currentRange = updateCurrentRange(currentRange, timeZone);
  const canScroll = currentRange.to.valueOf() - visibleRange.to > SCROLLING_THRESHOLD;
  return canScroll ? getNextRange(visibleRange, currentRange, timeZone) : undefined;
}

// Given a TimeRange, returns a new instance if using relative time, or else the same.
function updateCurrentRange(timeRange: TimeRange, timeZone: TimeZone) {
  return rangeUtil.isRelativeTimeRange(timeRange.raw)
    ? rangeUtil.convertRawToRange(timeRange.raw, timeZone)
    : timeRange;
}
