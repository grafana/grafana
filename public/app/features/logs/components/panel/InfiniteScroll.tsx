import { ReactNode, useCallback } from 'react';
import { ListOnItemsRenderedProps, VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { AbsoluteTimeRange, TimeRange } from '@grafana/data';

import { ProcessedLogModel } from './processing';

interface ChildrenProps {
  onItemsRendered: (params: ListOnItemsRenderedProps) => void;
  ref: (ref: VariableSizeList) => void;
}

interface Props {
  children: (props: ChildrenProps) => ReactNode;
  loadMore?: (range: AbsoluteTimeRange) => void;
  logs: ProcessedLogModel[];
  timeRange: TimeRange;
  timeZone: string;
}

export const InfiniteScroll = ({ children, loadMore, logs }: Props) => {
  const isItemLoaded = useCallback(
    (index: number) => {
      return !!logs[index];
    },
    [logs]
  );

  const handleLoadMore = useCallback(() => {}, []);

  return (
    <InfiniteLoader
      isItemLoaded={isItemLoaded}
      itemCount={logs.length && loadMore ? logs.length + 1 : logs.length}
      loadMoreItems={handleLoadMore}
      threshold={1}
    >
      {(props) => children(props)}
    </InfiniteLoader>
  );
};
