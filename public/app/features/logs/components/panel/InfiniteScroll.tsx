import { MutableRefObject, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ListChildComponentProps, ListOnItemsRenderedProps, ListOnScrollProps, VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { AbsoluteTimeRange, LogsSortOrder, TimeRange } from '@grafana/data';
import { Spinner } from '@grafana/ui';

import { canScrollBottom, getVisibleRange } from '../InfiniteScroll';

import { LogLine } from './LogLine';
import { LogLineMessage } from './LogLineMessage';
import { ProcessedLogModel } from './processing';

interface ChildrenProps {
  itemCount: number;
  getItemKey: (index: number) => string;
  onItemsRendered: (params: ListOnItemsRenderedProps) => void;
  onScroll: (props: ListOnScrollProps) => void;
  ref: (ref: VariableSizeList) => void;
  Renderer: (props: ListChildComponentProps) => ReactNode;
}

interface Props {
  children: (props: ChildrenProps) => ReactNode;
  handleOverflow: (index: number, id: string, height: number) => void;
  listRef: MutableRefObject<VariableSizeList | null>;
  loadMore?: (range: AbsoluteTimeRange) => void;
  logs: ProcessedLogModel[];
  showTime: boolean;
  sortOrder: LogsSortOrder;
  timeRange: TimeRange;
  timeZone: string;
  wrapLogMessage: boolean;
}

type InfiniteLoaderState = 'idle' | 'out-of-bounds' | 'pre-scroll' | 'loading';

export const InfiniteScroll = ({
  children,
  handleOverflow,
  loadMore,
  listRef,
  logs,
  showTime,
  sortOrder,
  timeRange,
  timeZone,
  wrapLogMessage,
}: Props) => {
  const [infiniteLoaderState, setInfiniteLoaderState] = useState<InfiniteLoaderState>('idle');
  const logsRef = useRef<ProcessedLogModel[]>([]);
  const prevScrollEvent = useRef<ListOnScrollProps | null>(null);

  useEffect(() => {
    const prevLogs = logsRef.current;
    // Not a logs update
    if (logs === prevLogs) {
      return;
    }
    logsRef.current = logs;
    // New logs, reset scroll position
    if (!loadMore || infiniteLoaderState === 'idle') {
      listRef.current?.scrollTo(0);
      return;
    }
    // Infinite scrolling request returned with no logs
    if (infiniteLoaderState === 'loading' && logs.length === prevLogs.length) {
      setInfiniteLoaderState('out-of-bounds');
      return;
    }
    setInfiniteLoaderState('idle');
  }, [infiniteLoaderState, listRef, loadMore, logs]);

  const isItemLoaded = useCallback(
    (index: number) => {
      return !!logs[index] || infiniteLoaderState === 'out-of-bounds';
    },
    [infiniteLoaderState, logs]
  );

  const handleLoadMore = useCallback(
    (fromIndex: number, toIndex: number) => {
      console.log(`Load more ${fromIndex} ${toIndex} ${isItemLoaded(toIndex)}`);
      if (isItemLoaded(toIndex)) {
        return;
      }
      setInfiniteLoaderState('pre-scroll');
    },
    [isItemLoaded]
  );

  const onScroll = useCallback(
    (event: ListOnScrollProps) => {
      const prevEvent = prevScrollEvent.current;
      prevScrollEvent.current = event;
      if (infiniteLoaderState !== 'pre-scroll') {
        return;
      }
      if (event.scrollUpdateWasRequested || event.scrollDirection !== prevEvent?.scrollDirection) {
        setInfiniteLoaderState('idle');
        return;
      }
      const newRange = canScrollBottom(getVisibleRange(logs), timeRange, timeZone, sortOrder);
      if (!newRange) {
        setInfiniteLoaderState('out-of-bounds');
        return;
      }
      setInfiniteLoaderState('loading');
      loadMore?.(newRange);
    },
    [infiniteLoaderState, loadMore, logs, sortOrder, timeRange, timeZone]
  );

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      if (!logs[index]) {
        return (
          <LogLineMessage style={style}>
            {getMessageFromInfiniteLoaderState(infiniteLoaderState, sortOrder)}
          </LogLineMessage>
        );
      }
      return (
        <LogLine
          index={index}
          log={logs[index]}
          showTime={showTime}
          style={style}
          wrapLogMessage={wrapLogMessage}
          onOverflow={handleOverflow}
        />
      );
    },
    [handleOverflow, infiniteLoaderState, logs, showTime, sortOrder, wrapLogMessage]
  );

  const getItemKey = useCallback(
    (index: number) => (logs[index] ? logs[index].uid : infiniteLoaderState),
    [infiniteLoaderState, logs]
  );

  const itemCount = logs.length && loadMore ? logs.length + 1 : logs.length;

  console.log(infiniteLoaderState, itemCount);

  return (
    <InfiniteLoader isItemLoaded={isItemLoaded} itemCount={itemCount} loadMoreItems={handleLoadMore} threshold={1}>
      {({ onItemsRendered, ref }) => children({ getItemKey, itemCount, onScroll, onItemsRendered, ref, Renderer })}
    </InfiniteLoader>
  );
};

function getMessageFromInfiniteLoaderState(state: InfiniteLoaderState, order: LogsSortOrder) {
  switch (state) {
    case 'out-of-bounds':
      return 'End of the selected time range.';
    case 'loading':
      return (
        <>
          Loading {order === LogsSortOrder.Ascending ? 'newer' : 'older'} logs... <Spinner inline />
        </>
      );
    case 'pre-scroll':
      return 'Scroll to load more';
    default:
      return null;
  }
}
