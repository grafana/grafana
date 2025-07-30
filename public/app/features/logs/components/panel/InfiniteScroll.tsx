import { ReactNode, useCallback, useEffect, useRef, useState, MouseEvent } from 'react';
import { usePrevious } from 'react-use';
import { ListChildComponentProps, ListOnItemsRenderedProps } from 'react-window';

import { AbsoluteTimeRange, LogsSortOrder, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { Spinner, useStyles2 } from '@grafana/ui';

import { canScrollBottom, getVisibleRange, ScrollDirection, shouldLoadMore } from '../InfiniteScroll';

import { getStyles, LogLine } from './LogLine';
import { LogLineMessage } from './LogLineMessage';
import { LogListModel } from './processing';
import { LogLineVirtualization } from './virtualization';

interface ChildrenProps {
  itemCount: number;
  getItemKey: (index: number) => string;
  onItemsRendered: (props: ListOnItemsRenderedProps) => void;
  Renderer: (props: ListChildComponentProps) => ReactNode;
}

interface Props {
  children: (props: ChildrenProps) => ReactNode;
  displayedFields: string[];
  handleOverflow: (index: number, id: string, height?: number) => void;
  infiniteScrollMode: InfiniteScrollMode;
  loadMore?: LoadMoreLogsType;
  logs: LogListModel[];
  onClick: (e: MouseEvent<HTMLElement>, log: LogListModel) => void;
  scrollElement: HTMLDivElement | null;
  setInitialScrollPosition: () => void;
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
  const [autoScroll, setAutoScroll] = useState(false);
  const prevLogs = usePrevious(logs);
  const prevSortOrder = usePrevious(sortOrder);
  const lastScroll = useRef<number>(scrollElement?.scrollTop || 0);
  const lastEvent = useRef<Event | WheelEvent | null>(null);
  const countRef = useRef(0);
  const lastLogOfPage = useRef<string[]>([]);
  const styles = useStyles2(getStyles, virtualization);
  const resetStateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Logs have not changed, ignore effect
    if (!prevLogs || prevLogs === logs) {
      return;
    }
    // New logs are from infinite scrolling
    if (infiniteLoaderState === 'loading') {
      // out-of-bounds if no new logs returned
      setInfiniteLoaderState(
        logs.length === prevLogs.length && infiniteScrollMode === 'interval' ? 'out-of-bounds' : 'idle'
      );
    } else {
      lastLogOfPage.current = [];
      setAutoScroll(true);
    }
  }, [infiniteLoaderState, infiniteScrollMode, logs, prevLogs]);

  useEffect(() => {
    if (prevSortOrder && prevSortOrder !== sortOrder) {
      setInfiniteLoaderState('idle');
    }
  }, [prevSortOrder, sortOrder]);

  useEffect(() => {
    if (autoScroll) {
      setInitialScrollPosition();
      setAutoScroll(false);
    }
  }, [autoScroll, setInitialScrollPosition]);

  const onLoadMore = useCallback(
    (scrollDirection: ScrollDirection) => {
      const newRange = canScrollBottom(getVisibleRange(logs), timeRange, timeZone, sortOrder);
      if (!newRange && infiniteScrollMode === 'interval') {
        setInfiniteLoaderState('out-of-bounds');
        return;
      }
      if (scrollDirection === ScrollDirection.Bottom) {
        lastLogOfPage.current.push(logs[logs.length - 1].uid);
      } else {
        lastLogOfPage.current.push(logs[0].uid);
      }
      setInfiniteLoaderState('loading');
      loadMore?.(newRange ?? getVisibleRange(logs), scrollDirection);

      reportInteraction('grafana_logs_infinite_scrolling', {
        direction: 'bottom',
        sort_order: sortOrder,
      });
    },
    [infiniteScrollMode, loadMore, logs, sortOrder, timeRange, timeZone]
  );

  useEffect(() => {
    if (!scrollElement || !loadMore || !config.featureToggles.logsInfiniteScrolling) {
      return;
    }

    function handleScroll(event: Event | WheelEvent) {
      if (!scrollElement || !loadMore || !logs.length) {
        return;
      }
      const scrollDirection = shouldLoadMore(event, lastEvent.current, countRef, scrollElement, lastScroll.current);
      lastEvent.current = event;
      lastScroll.current = scrollElement.scrollTop;
      if (infiniteLoaderState !== 'pre-scroll-bottom' && infiniteLoaderState !== 'pre-scroll-top') {
        if (infiniteScrollMode === 'unlimited' && scrollDirection === ScrollDirection.Top) {
          setInfiniteLoaderState('pre-scroll-top');
          resetStateTimeout.current = setTimeout(() => {
            setInfiniteLoaderState((state) => (state === 'pre-scroll-top' ? 'idle' : state));
          }, 10000);
          return;
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
  }, [infiniteLoaderState, infiniteScrollMode, loadMore, logs.length, onLoadMore, scrollElement]);

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
      virtualization,
      wrapLogMessage,
    ]
  );

  const onItemsRendered = useCallback(
    (props: ListOnItemsRenderedProps) => {
      if (!scrollElement || infiniteLoaderState === 'loading' || infiniteLoaderState === 'out-of-bounds') {
        return;
      }
      if (scrollElement.scrollHeight <= scrollElement.clientHeight) {
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
    [infiniteLoaderState, logs.length, scrollElement]
  );

  const getItemKey = useCallback((index: number) => (logs[index] ? logs[index].uid : index.toString()), [logs]);

  const itemCount = logs.length && loadMore && infiniteLoaderState !== 'idle' ? logs.length + 1 : logs.length;

  return (
    <>
      {infiniteLoaderState === 'pre-scroll-top' && (
        <div className={styles.loadMoreTopContainer}>
          <LogLineMessage style={{}} styles={styles} onClick={loadMoreTop}>
            {t('logs.infinite-scroll.load-more', 'Scroll to load more')}
          </LogLineMessage>
        </div>
      )}
      {children({ getItemKey, itemCount, onItemsRendered, Renderer })}
    </>
  );
};

function getMessageFromInfiniteLoaderState(state: InfiniteLoaderState, order: LogsSortOrder) {
  switch (state) {
    case 'out-of-bounds':
      return t('logs.infinite-scroll.end-of-range', 'End of the selected time range.');
    case 'loading':
      return (
        <>
          {order === LogsSortOrder.Ascending
            ? t('logs.infinite-scroll.load-newer', 'Loading newer logs...')
            : t('logs.infinite-scroll.load-older', 'Loading older logs...')}{' '}
          <Spinner inline />
        </>
      );
    case 'pre-scroll-bottom':
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
