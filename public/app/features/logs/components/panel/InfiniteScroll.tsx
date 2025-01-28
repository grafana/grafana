import { MutableRefObject, ReactNode, useCallback, useEffect, useRef } from 'react';
import { ListOnItemsRenderedProps, VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { AbsoluteTimeRange, LogsSortOrder, TimeRange } from '@grafana/data';

import { canScrollBottom, getVisibleRange } from '../InfiniteScroll';

import { ProcessedLogModel } from './processing';

interface ChildrenProps {
  itemCount: number;
  onItemsRendered: (params: ListOnItemsRenderedProps) => void;
  ref: (ref: VariableSizeList) => void;
}

interface Props {
  children: (props: ChildrenProps) => ReactNode;
  listRef: MutableRefObject<VariableSizeList | null>;
  loadMore?: (range: AbsoluteTimeRange) => void;
  logs: ProcessedLogModel[];
  sortOrder: LogsSortOrder;
  timeRange: TimeRange;
  timeZone: string;
}

export const InfiniteScroll = ({ children, loadMore, listRef, logs, sortOrder, timeRange, timeZone }: Props) => {
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

  const itemCount = logs.length && loadMore ? logs.length + 1 : logs.length;

  return (
    <InfiniteLoader isItemLoaded={isItemLoaded} itemCount={itemCount} loadMoreItems={handleLoadMore} threshold={1}>
      {({ onItemsRendered, ref }) => children({ itemCount, onItemsRendered, ref })}
    </InfiniteLoader>
  );
};
