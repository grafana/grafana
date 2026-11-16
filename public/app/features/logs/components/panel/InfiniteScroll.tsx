import {
  type ComponentType,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { usePrevious } from 'react-use';
import { type ListChildComponentProps, type ListOnItemsRenderedProps } from 'react-window';

import { LoadingState, LogsSortOrder, type TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Spinner, useStyles2 } from '@grafana/ui';

import {
  canScrollBottom,
  canScrollTop,
  getVisibleRange,
  type InfiniteScrollTimeRange,
  loadMoreRangeFromVisible,
  ScrollDirection,
  shouldLoadMore,
} from '../infiniteScrollUtils';

import { getStyles, LogLine } from './LogLine';
import { LogLineMessage } from './LogLineMessage';
import { type LogListModel } from './processing';
import { type LogLineVirtualization } from './virtualization';

// The data every LogLine needs
interface LogData {
  displayedFields: string[];
  firstLogOfPage: string[];
  handleOverflow: (index: number, id: string, height?: number) => void;
  infiniteLoaderState: InfiniteLoaderState;
  lastLogOfPage: string[];
  loadMoreBottom: () => void;
  logs: LogListModel[];
  onClick: (e: MouseEvent<HTMLElement>, log: LogListModel) => void;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  styles: ReturnType<typeof getStyles>;
  timeRange: TimeRange;
  timeZone: string;
  virtualization: LogLineVirtualization;
  wrapLogMessage: boolean;
}

interface ChildrenProps {
  itemCount: number;
  itemData: LogData;
  getItemKey: (index: number) => string;
  onItemsRendered: (props: ListOnItemsRenderedProps) => void;
  Log: ComponentType<ListChildComponentProps<LogData>>;
}

export interface Props {
  children: (props: ChildrenProps) => ReactNode;
  displayedFields: string[];
  handleOverflow: (index: number, id: string, height?: number) => void;
  infiniteScrollMode: InfiniteScrollMode;
  /** Allows loading more logs when scrolling to the top of the list. Always enabled in unlimited mode. */
  infiniteScrollTop?: boolean;
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
  | ((range: InfiniteScrollTimeRange) => void)
  | ((range: InfiniteScrollTimeRange, scrollDirection: ScrollDirection) => void);

export const InfiniteScroll = ({
  children,
  displayedFields,
  handleOverflow,
  infiniteScrollMode,
  infiniteScrollTop = false,
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
  const [loadDirection, setLoadDirection] = useState<ScrollDirection>(ScrollDirection.Bottom);
  const [autoScroll, setAutoScroll] = useState(false);
  const prevLogs = usePrevious(logs);
  const prevSortOrder = usePrevious(sortOrder);
  const lastScroll = useRef<number>(scrollElement?.scrollTop || 0);
  const lastEvent = useRef<Event | WheelEvent | null>(null);
  const countRef = useRef(0);
  const lastLogOfPage = useRef<string[]>([]);
  const firstLogOfPage = useRef<string[]>([]);
  const styles = useStyles2(getStyles, virtualization, displayedFields);
  const resetStateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToLogLineRef = useRef<LogListModel | undefined>(undefined);
  const noScrollRef = useRef<undefined | boolean>(undefined);
  const loadMoreCountRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const topScrollEnabled = infiniteScrollTop || infiniteScrollMode === 'unlimited';
  // The request backing a load-more is in flight while its state is Loading or Streaming.
  const requestInFlight = loadingState === LoadingState.Loading || loadingState === LoadingState.Streaming;
  const prevInFlight = usePrevious(requestInFlight);
  // Fresh logs from a new query (not infinite scrolling).
  const isFreshQuery = Boolean(prevLogs) && prevLogs !== logs && infiniteLoaderState !== 'loading';

  useEffect(() => {
    // Reset paging and scroll, and clear a stale 'out-of-bounds' so re-running the query re-enables scrolling
    // instead of latching end-of-range.
    if (isFreshQuery) {
      lastLogOfPage.current = [];
      firstLogOfPage.current = [];
      scrollToLogLineRef.current = undefined;
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
        scrollToLogLineRef.current = undefined;
        setInfiniteLoaderState('idle');
        return;
      }
      // New logs have been returned from the load-more request.
      if (prevLogs !== logs) {
        const startCount = loadMoreCountRef.current;
        settledRef.current = false;
        loadMoreCountRef.current = null;
        const outOfBounds = startCount !== null && logs.length === startCount && infiniteScrollMode === 'interval';
        setInfiniteLoaderState(outOfBounds ? 'out-of-bounds' : 'idle');
        if (scrollToLogLineRef.current) {
          setAutoScroll(true);
        }
      }
    }
  }, [
    infiniteLoaderState,
    infiniteScrollMode,
    isFreshQuery,
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
      const visibleRange = getVisibleRange(logs);
      const newRange =
        scrollDirection === ScrollDirection.Bottom
          ? canScrollBottom(visibleRange, timeRange, timeZone, sortOrder)
          : canScrollTop(visibleRange, timeRange, timeZone, sortOrder);
      setLoadDirection(scrollDirection);
      if (!newRange && infiniteScrollMode === 'interval') {
        setInfiniteLoaderState('out-of-bounds');
        return;
      }
      if (scrollDirection === ScrollDirection.Bottom) {
        scrollToLogLineRef.current = undefined;
        lastLogOfPage.current.push(logs[logs.length - 1].uid);
      } else {
        // New logs are prepended, keep the current first line in view and mark it as the start of the previous page.
        scrollToLogLineRef.current = logs[0];
        firstLogOfPage.current.push(logs[0].uid);
      }
      // Snapshot the row count so the completion effect can tell whether new rows arrived.
      loadMoreCountRef.current = logs.length;
      setInfiniteLoaderState('loading');
      loadMore?.(newRange ?? loadMoreRangeFromVisible(visibleRange, scrollDirection, sortOrder), scrollDirection);

      reportInteraction('grafana_logs_infinite_scrolling', {
        direction: scrollDirection,
        sort_order: sortOrder,
      });
    },
    [infiniteScrollMode, loadMore, logs, sortOrder, timeRange, timeZone]
  );

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
        const topEndOfRange = infiniteLoaderState === 'out-of-bounds' && loadDirection === ScrollDirection.Top;
        if (
          topScrollEnabled &&
          scrollDirection === ScrollDirection.Top &&
          infiniteLoaderState !== 'loading' &&
          !topEndOfRange
        ) {
          setInfiniteLoaderState('pre-scroll-top');
          resetStateTimeout.current = setTimeout(() => {
            setInfiniteLoaderState((state) => (state === 'pre-scroll-top' ? 'idle' : state));
          }, 10000);
          return;
        }
        return;
      }
      if (scrollDirection === ScrollDirection.NoScroll) {
        return;
      }
      if (scrollDirection === ScrollDirection.Top && !topScrollEnabled) {
        return;
      }
      onLoadMore(scrollDirection);
    }

    scrollElement.addEventListener('scroll', handleScroll);
    scrollElement.addEventListener('wheel', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('wheel', handleScroll);
    };
  }, [infiniteLoaderState, loadDirection, loadMore, logs.length, onLoadMore, scrollElement, topScrollEnabled]);

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

  const itemData = useMemo<LogData>(
    () => ({
      displayedFields,
      firstLogOfPage: isFreshQuery ? [] : firstLogOfPage.current,
      handleOverflow,
      infiniteLoaderState,
      lastLogOfPage: isFreshQuery ? [] : lastLogOfPage.current,
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
    }),
    [
      displayedFields,
      handleOverflow,
      infiniteLoaderState,
      isFreshQuery,
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
      if (infiniteLoaderState === 'loading') {
        return;
      }
      // The end of the range at the top overlays the first line, so it is dismissed once the user scrolls away.
      const topEndOfRange = infiniteLoaderState === 'out-of-bounds' && loadDirection === ScrollDirection.Top;
      if (infiniteLoaderState === 'out-of-bounds' && !(topEndOfRange && props.visibleStartIndex > 0)) {
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
    [infiniteLoaderState, loadDirection, logs, scrollElement]
  );

  const getItemKey = useCallback((index: number) => (logs[index] ? logs[index].uniqueKey : index.toString()), [logs]);

  // Messages related to the bottom direction are rendered as an extra line at the end of the list.
  const showBottomMessage =
    infiniteLoaderState === 'pre-scroll-bottom' ||
    ((infiniteLoaderState === 'loading' || infiniteLoaderState === 'out-of-bounds') &&
      loadDirection === ScrollDirection.Bottom);
  const itemCount = logs.length && loadMore && showBottomMessage ? logs.length + 1 : logs.length;

  const showTopMessage =
    infiniteLoaderState === 'pre-scroll-top' ||
    ((infiniteLoaderState === 'loading' || infiniteLoaderState === 'out-of-bounds') &&
      loadDirection === ScrollDirection.Top);

  return (
    <>
      {showTopMessage && (
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
      {children({ getItemKey, itemCount, itemData, onItemsRendered, Log })}
    </>
  );
};

function getMessageFromInfiniteLoaderState(
  state: InfiniteLoaderState,
  order: LogsSortOrder,
  direction: ScrollDirection = ScrollDirection.Bottom
) {
  switch (state) {
    case 'out-of-bounds':
      return t('logs.infinite-scroll.end-of-range', 'End of the selected time range.');
    case 'loading':
      // Scrolling to the bottom loads older logs in descending order, and newer logs in ascending order. Top is the opposite.
      return (
        <>
          {(direction === ScrollDirection.Bottom) === (order === LogsSortOrder.Ascending)
            ? t('logs.infinite-scroll.load-newer', 'Loading newer logs...')
            : t('logs.infinite-scroll.load-older', 'Loading older logs...')}{' '}
          <Spinner inline />
        </>
      );
    case 'pre-scroll-bottom':
    case 'pre-scroll-top':
      return t('logs.infinite-scroll.load-more', 'Scroll to load more');
    default:
      return null;
  }
}

const Log = memo(({ index, style, data }: ListChildComponentProps<LogData>) => {
  const {
    displayedFields,
    firstLogOfPage,
    handleOverflow,
    infiniteLoaderState,
    lastLogOfPage,
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
  } = data;

  if (!logs[index] && infiniteLoaderState !== 'idle') {
    return (
      <LogLineMessage
        style={style}
        styles={styles}
        onClick={infiniteLoaderState === 'pre-scroll-bottom' ? loadMoreBottom : undefined}
      >
        {getMessageFromInfiniteLoaderState(infiniteLoaderState, sortOrder)}
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
      variant={getLogLineVariant(logs, index, lastLogOfPage, firstLogOfPage)}
      virtualization={virtualization}
      wrapLogMessage={wrapLogMessage}
      onOverflow={handleOverflow}
    />
  );
});
Log.displayName = 'InfiniteScrollLog';

function getLogLineVariant(logs: LogListModel[], index: number, lastLogOfPage: string[], firstLogOfPage: string[]) {
  if (logs[index] && firstLogOfPage.includes(logs[index].uid)) {
    // First log of a page loaded from the top
    return 'infinite-scroll';
  }
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
