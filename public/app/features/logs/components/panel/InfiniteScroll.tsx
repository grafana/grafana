import { MutableRefObject, ReactNode, useCallback, useEffect, useRef } from 'react';
import { ListChildComponentProps, ListOnItemsRenderedProps, VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { AbsoluteTimeRange, LogsSortOrder, TimeRange } from '@grafana/data';

import { canScrollBottom, getVisibleRange } from '../InfiniteScroll';

import { LogLine } from './LogLine';
import { ProcessedLogModel } from './processing';

interface ChildrenProps {
  itemCount: number;
  onItemsRendered: (params: ListOnItemsRenderedProps) => void;
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
  const logsRef = useRef(logs);

  useEffect(() => {
    if (!loadMore || logs.length !== logsRef.current.length) {
      listRef.current?.scrollTo(0);
    }
  }, [listRef, loadMore, logs.length]);

  const isItemLoaded = useCallback(
    (index: number) => {
      return !!logs[index];
    },
    [logs]
  );

  const handleLoadMore = useCallback(() => {
    const newRange = canScrollBottom(getVisibleRange(logs), timeRange, timeZone, sortOrder);
    if (!newRange) {
      //setLowerOutOfRange(true);
      return;
    }
    loadMore?.(newRange);
  }, [loadMore, logs, sortOrder, timeRange, timeZone]);

  const Renderer = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      if (!logs[index]) {
        return null;
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
    [handleOverflow, logs, showTime, wrapLogMessage]
  );

  const itemCount = logs.length && loadMore ? logs.length + 1 : logs.length;

  return (
    <InfiniteLoader isItemLoaded={isItemLoaded} itemCount={itemCount} loadMoreItems={handleLoadMore} threshold={1}>
      {({ onItemsRendered, ref }) => children({ itemCount, onItemsRendered, ref, Renderer })}
    </InfiniteLoader>
  );
};
