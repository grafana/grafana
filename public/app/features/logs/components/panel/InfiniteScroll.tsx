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
  loadMore?: (range: AbsoluteTimeRange) => void;
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

type InfiniteLoaderState = 'idle' | 'out-of-bounds' | 'pre-scroll' | 'loading';

export const InfiniteScroll = ({
  children,
  displayedFields,
  handleOverflow,
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

  useEffect(() => {
    // Logs have not changed, ignore effect
    if (!prevLogs || prevLogs === logs) {
      return;
    }
    // New logs are from infinite scrolling
    if (infiniteLoaderState === 'loading') {
      // out-of-bounds if no new logs returned
      setInfiniteLoaderState(logs.length === prevLogs.length ? 'out-of-bounds' : 'idle');
    } else {
      lastLogOfPage.current = [];
      setAutoScroll(true);
    }
  }, [infiniteLoaderState, logs, prevLogs]);

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

  const onLoadMore = useCallback(() => {
    const newRange = canScrollBottom(getVisibleRange(logs), timeRange, timeZone, sortOrder);
    if (!newRange) {
      setInfiniteLoaderState('out-of-bounds');
      return;
    }
    lastLogOfPage.current.push(logs[logs.length - 1].uid);
    setInfiniteLoaderState('loading');
    loadMore?.(newRange);

    reportInteraction('grafana_logs_infinite_scrolling', {
      direction: 'bottom',
      sort_order: sortOrder,
    });
  }, [loadMore, logs, sortOrder, timeRange, timeZone]);

  useEffect(() => {
    if (!scrollElement || !loadMore || !config.featureToggles.logsInfiniteScrolling) {
      return;
    }

    function handleScroll(event: Event | WheelEvent) {
      if (!scrollElement || !loadMore || !logs.length || infiniteLoaderState !== 'pre-scroll') {
        return;
      }
      const scrollDirection = shouldLoadMore(event, lastEvent.current, countRef, scrollElement, lastScroll.current);
      lastEvent.current = event;
      lastScroll.current = scrollElement.scrollTop;
      if (scrollDirection === ScrollDirection.Bottom) {
        onLoadMore();
      }
    }

    scrollElement.addEventListener('scroll', handleScroll);
    scrollElement.addEventListener('wheel', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('wheel', handleScroll);
    };
  }, [infiniteLoaderState, loadMore, logs.length, onLoadMore, scrollElement]);

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      if (!logs[index] && infiniteLoaderState !== 'idle') {
        return (
          <LogLineMessage
            style={style}
            styles={styles}
            onClick={infiniteLoaderState === 'pre-scroll' ? onLoadMore : undefined}
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
      logs,
      onClick,
      onLoadMore,
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
        setInfiniteLoaderState('pre-scroll');
      } else if (props.visibleStartIndex < preScrollIndex) {
        setInfiniteLoaderState('idle');
      }
    },
    [infiniteLoaderState, logs.length, scrollElement]
  );

  const getItemKey = useCallback((index: number) => (logs[index] ? logs[index].uid : index.toString()), [logs]);

  const itemCount = logs.length && loadMore && infiniteLoaderState !== 'idle' ? logs.length + 1 : logs.length;

  return <>{children({ getItemKey, itemCount, onItemsRendered, Renderer })}</>;
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
    case 'pre-scroll':
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
