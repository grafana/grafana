import { type ReactNode, useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { usePrevious } from 'react-use';
import { type ListChildComponentProps, type ListOnItemsRenderedProps } from 'react-window';

import { type AbsoluteTimeRange, LoadingState, LogsSortOrder, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Spinner, useStyles2 } from '@grafana/ui';

import {
  canScrollBottom,
  canScrollTop,
  getVisibleRange,
  ScrollDirection,
  shouldLoadMore,
} from '../infiniteScrollUtils';

import { getStyles, LogLine } from './LogLine';
import { LogLineMessage } from './LogLineMessage';
import { type LogListModel } from './processing';
import { type LogLineVirtualization } from './virtualization';

interface ChildrenProps {
  itemCount: number;
  getItemKey: (index: number) => string;
  onItemsRendered: (props: ListOnItemsRenderedProps) => void;
  Renderer: (props: ListChildComponentProps) => ReactNode;
}

export interface Props {
  children: (props: ChildrenProps) => ReactNode;
  displayedFields: string[];
  handleOverflow: (index: number, id: string, height?: number) => void;
  infiniteScrollMode: InfiniteScrollMode;
  loadingState?: LoadingState;
  loadMore?: LoadMoreLogsType;
  logs: LogListModel[];
  onClick: (e: MouseEvent<HTMLElement>, log: LogListModel) => void;
  scrollElement: HTMLDivElement | null;
  setInitialScrollPosition: (log?: LogListModel) => void;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  timeRange: TimeRange;
  timeZone: string;
  virtualization: LogLineVirtualization;
  wrapLogMessage: boolean;
}

type InfiniteLoaderState = 'idle' | 'out-of-bounds' | 'pre-scroll-top' | 'pre-scroll-bottom' | 'loading';
export type InfiniteScrollMode = 'interval' | 'unlimited';
export type LoadMoreLogsType =
  | ((range: AbsoluteTimeRange) => void)
  | ((range: AbsoluteTimeRange, scrollDirection: ScrollDirection) => void);

export const InfiniteScroll = ({
  children,
  displayedFields,
  handleOverflow,
  infiniteScrollMode,
  loadingState,
  loadMore,
  logs,
  onClick,
  scrollElement,
  setInitialScrollPosition,
  showTime,
  sortOrder,
  timeRange,
  timeZone,
  virtualization,
  wrapLogMessage,
}: Props) => {
  const [infiniteLoaderState, setInfiniteLoaderState] = useState<InfiniteLoaderState>('idle');
  const [loadDirection, setLoadDirection] = useState<ScrollDirection>(ScrollDirection.NoScroll);
  const [autoScroll, setAutoScroll] = useState(false);
  const prevLogs = usePrevious(logs);
  const prevSortOrder = usePrevious(sortOrder);
  const lastScroll = useRef<number>(scrollElement?.scrollTop || 0);
  const lastEvent = useRef<Event | WheelEvent | null>(null);
  const countRef = useRef(0);
  const lastLogOfPage = useRef<string[]>([]);
  const styles = useStyles2(getStyles, virtualization, displayedFields);
  const resetStateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToLogLineRef = useRef<LogListModel | undefined>(undefined);
  const noScrollRef = useRef<undefined | boolean>(undefined);
  const loadMoreCountRef = useRef<number | null>(null);
  const exhaustedTopRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  // The request backing a load-more is in flight while its state is Loading or Streaming.
  const requestInFlight = loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming;
  const prevInFlight = usePrevious(requestInFlight);

  useEffect(() => {
    // Fresh logs from a new query (not infinite scrolling): reset paging, scroll, and clear a stale
    // 'out-of-bounds' so re-running the query re-enables scrolling instead of latching end-of-range.
    if (prevLogs && prevLogs !== logs && infiniteLoaderState !== 'loading') {
      lastLogOfPage.current = [];
      exhaustedTopRef.current = null;
      setAutoScroll(true);
      if (infiniteLoaderState !== 'idle') {
        setInfiniteLoaderState('idle');
      }
      return;
    }
    if (infiniteLoaderState === 'loading') {
      // Only resolve after the in-flight -> settled transition, ignoring the transient Done cancelQueries sets at the start.
      if (prevInFlight && !requestInFlight) {
        settledRef.current = true;
      }
      if (!settledRef.current) {
        return;
      }
      if (loadingState === LoadingState.Error) {
        settledRef.current = false;
        loadMoreCountRef.current = null;
        setInfiniteLoaderState('idle');
        return;
      }
      // New logs have been returned from the load-more request.
      if (prevLogs !== logs) {
        const startCount = loadMoreCountRef.current;
        settledRef.current = false;
        loadMoreCountRef.current = null;
        const noNewLogs = startCount !== null && logs.length === startCount && infiniteScrollMode === 'interval';
        if (noNewLogs && loadDirection === ScrollDirection.Top) {
          // 'out-of-bounds' renders the end-of-range row at the bottom and blocks loading there, so an
          // exhausted top is remembered separately.
          exhaustedTopRef.current = logs[0]?.uid ?? null;
        }
        setInfiniteLoaderState(noNewLogs && loadDirection !== ScrollDirection.Top ? 'out-of-bounds' : 'idle');
        if (scrollToLogLineRef.current) {
          setAutoScroll(true);
        }
      }
    }
  }, [
    infiniteLoaderState,
    infiniteScrollMode,
    loadDirection,
    loadingState,
    requestInFlight,
    prevInFlight,
    logs,
    prevLogs,
  ]);

  useEffect(() => {
    if (prevSortOrder && prevSortOrder !== sortOrder) {
      setInfiniteLoaderState('idle');
    }
  }, [prevSortOrder, sortOrder]);

  useEffect(() => {
    if (autoScroll && !requestInFlight) {
      setInitialScrollPosition(scrollToLogLineRef.current);
      scrollToLogLineRef.current = undefined;
      setAutoScroll(false);
    }
  }, [autoScroll, requestInFlight, setInitialScrollPosition]);

  const onLoadMore = useCallback(
    (scrollDirection: ScrollDirection) => {
      const newRange =
        scrollDirection === ScrollDirection.Bottom
          ? canScrollBottom(getVisibleRange(logs), timeRange, timeZone, sortOrder)
          : canScrollTop(getVisibleRange(logs), timeRange, timeZone, sortOrder);
      if (!newRange && infiniteScrollMode === 'interval') {
        if (scrollDirection === ScrollDirection.Top) {
          exhaustedTopRef.current = logs[0].uid;
          setInfiniteLoaderState('idle');
        } else {
          setInfiniteLoaderState('out-of-bounds');
        }
        return;
      }
      if (scrollDirection === ScrollDirection.Bottom) {
        lastLogOfPage.current.push(logs[logs.length - 1].uid);
      } else {
        scrollToLogLineRef.current = logs[0];
        lastLogOfPage.current.push(logs[0].uid);
      }
      // Snapshot the row count so the completion effect can tell whether new rows arrived.
      loadMoreCountRef.current = logs.length;
      setLoadDirection(scrollDirection);
      setInfiniteLoaderState('loading');
      loadMore?.(newRange ?? getVisibleRange(logs), scrollDirection);

      reportInteraction('grafana_logs_infinite_scrolling', {
        direction: scrollDirection,
        sort_order: sortOrder,
      });
    },
    [infiniteScrollMode, loadMore, logs, sortOrder, timeRange, timeZone]
  );

  const canLoadMoreTop = useCallback(() => {
    if (infiniteScrollMode === 'unlimited') {
      return true;
    }
    if (exhaustedTopRef.current !== null && exhaustedTopRef.current === logs[0]?.uid) {
      return false;
    }
    return canScrollTop(getVisibleRange(logs), timeRange, timeZone, sortOrder) !== undefined;
  }, [infiniteScrollMode, logs, sortOrder, timeRange, timeZone]);

  useEffect(() => {
    if (!scrollElement || !loadMore) {
      return;
    }

    function handleScroll(event: Event | WheelEvent) {
      if (
        !scrollElement ||
        !loadMore ||
        !logs.length ||
        noScrollRef.current === undefined ||
        noScrollRef.current === true
      ) {
        return;
      }
      const scrollDirection = shouldLoadMore(event, lastEvent.current, countRef, scrollElement, lastScroll.current);
      lastEvent.current = event;
      lastScroll.current = scrollElement.scrollTop;
      if (infiniteLoaderState !== 'pre-scroll-bottom' && infiniteLoaderState !== 'pre-scroll-top') {
        if (scrollDirection === ScrollDirection.Top && canLoadMoreTop()) {
          setInfiniteLoaderState('pre-scroll-top');
          resetStateTimeout.current = setTimeout(() => {
            setInfiniteLoaderState((state) => (state === 'pre-scroll-top' ? 'idle' : state));
          }, 10000);
        }
        return;
      }
      if (scrollDirection !== ScrollDirection.NoScroll) {
        onLoadMore(scrollDirection);
      }
    }

    scrollElement.addEventListener('scroll', handleScroll);
    scrollElement.addEventListener('wheel', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('wheel', handleScroll);
    };
  }, [canLoadMoreTop, infiniteLoaderState, loadMore, logs.length, onLoadMore, scrollElement]);

  useEffect(() => {
    return () => {
      if (resetStateTimeout.current) {
        clearTimeout(resetStateTimeout.current);
      }
    };
  }, []);

  const loadMoreTop = useCallback(() => {
    if (resetStateTimeout.current) {
      clearTimeout(resetStateTimeout.current);
    }
    onLoadMore(ScrollDirection.Top);
  }, [onLoadMore]);

  const loadMoreBottom = useCallback(() => {
    onLoadMore(ScrollDirection.Bottom);
  }, [onLoadMore]);

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      if (!logs[index] && infiniteLoaderState !== 'idle') {
        return (
          <LogLineMessage
            style={style}
            styles={styles}
            onClick={infiniteLoaderState === 'pre-scroll-bottom' ? loadMoreBottom : undefined}
          >
            {getMessageFromInfiniteLoaderState(infiniteLoaderState, sortOrder, ScrollDirection.Bottom)}
          </LogLineMessage>
        );
      }
      return (
        <LogLine
          displayedFields={displayedFields}
          index={index}
          log={logs[index]}
          logs={logs}
          onClick={onClick}
          showTime={showTime}
          style={style}
          styles={styles}
          timeRange={timeRange}
          timeZone={timeZone}
          variant={getLogLineVariant(logs, index, lastLogOfPage.current)}
          virtualization={virtualization}
          wrapLogMessage={wrapLogMessage}
          onOverflow={handleOverflow}
        />
      );
    },
    [
      displayedFields,
      handleOverflow,
      infiniteLoaderState,
      loadMoreBottom,
      logs,
      onClick,
      showTime,
      sortOrder,
      styles,
      timeRange,
      timeZone,
      virtualization,
      wrapLogMessage,
    ]
  );

  const onItemsRendered = useCallback(
    (props: ListOnItemsRenderedProps) => {
      if (!scrollElement) {
        return;
      }
      if (props.visibleStartIndex === 0) {
        noScrollRef.current = scrollElement.scrollHeight <= scrollElement.clientHeight;
      }
      if (noScrollRef.current) {
        setInfiniteLoaderState('idle');
        return;
      }
      if (infiniteLoaderState === 'loading' || infiniteLoaderState === 'out-of-bounds') {
        return;
      }
      const lastLogIndex = logs.length - 1;
      const preScrollIndex = logs.length - 2;
      if (props.visibleStopIndex >= lastLogIndex) {
        setInfiniteLoaderState('pre-scroll-bottom');
      } else if (props.visibleStartIndex < preScrollIndex) {
        setInfiniteLoaderState('idle');
      }
    },
    [infiniteLoaderState, logs, scrollElement]
  );

  const getItemKey = useCallback((index: number) => (logs[index] ? logs[index].uniqueKey : index.toString()), [logs]);

  const loadingTop = infiniteLoaderState === 'loading' && loadDirection === ScrollDirection.Top;
  const showBottomRow = infiniteLoaderState !== 'idle' && infiniteLoaderState !== 'pre-scroll-top' && !loadingTop;
  const itemCount = logs.length && loadMore && showBottomRow ? logs.length + 1 : logs.length;

  return (
    <>
      {(infiniteLoaderState === 'pre-scroll-top' || loadingTop) && (
        <div className={styles.loadMoreTopContainer}>
          <LogLineMessage
            style={{}}
            styles={styles}
            onClick={infiniteLoaderState === 'pre-scroll-top' ? loadMoreTop : undefined}
          >
            {getMessageFromInfiniteLoaderState(infiniteLoaderState, sortOrder, ScrollDirection.Top)}
          </LogLineMessage>
        </div>
      )}
      {children({ getItemKey, itemCount, onItemsRendered, Renderer })}
    </>
  );
};

function getMessageFromInfiniteLoaderState(state: InfiniteLoaderState, order: LogsSortOrder, edge: ScrollDirection) {
  switch (state) {
    case 'out-of-bounds':
      return t('logs.infinite-scroll.end-of-range', 'End of the selected time range.');
    case 'loading': {
      const loadsNewer = (edge === ScrollDirection.Bottom) === (order === LogsSortOrder.Ascending);
      return (
        <>
          {loadsNewer
            ? t('logs.infinite-scroll.load-newer', 'Loading newer logs...')
            : t('logs.infinite-scroll.load-older', 'Loading older logs...')}{' '}
          <Spinner inline />
        </>
      );
    }
    case 'pre-scroll-bottom':
    case 'pre-scroll-top':
      return t('logs.infinite-scroll.load-more', 'Scroll to load more');
    default:
      return null;
  }
}

function getLogLineVariant(logs: LogListModel[], index: number, lastLogOfPage: string[]) {
  if (!lastLogOfPage.length || !logs[index - 1]) {
    return undefined;
  }
  const prevLog = logs[index - 1];
  for (const uid of lastLogOfPage) {
    if (prevLog.uid === uid) {
      // First log of an infinite scrolling page
      return 'infinite-scroll';
    }
  }
  return undefined;
}
