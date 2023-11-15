import React, { ReactNode, useEffect } from 'react';

import { AbsoluteTimeRange, LogRowModel, TimeRange } from '@grafana/data';
import { LogsSortOrder } from '@grafana/schema';

type Props = {
  children: ReactNode;
  loading: boolean;
  loadMoreLogs?: (range: AbsoluteTimeRange) => void;
  range: TimeRange;
  rows: LogRowModel[];
  scrollElement?: HTMLDivElement;
  sortOrder: LogsSortOrder;
};

export const InfiniteScroll = ({ children, loadMoreLogs, range, rows, scrollElement, sortOrder }: Props) => {
  useEffect(() => {
    if (!scrollElement || !loadMoreLogs) {
      return;
    }

    function handleScroll() {
      if (!scrollElement || !loadMoreLogs || !rows.length || !shouldLoadMore(scrollElement, sortOrder)) {
        return;
      }
      loadMoreLogs(getNextRange(getVisibleRange(rows), range));
      scrollElement?.removeEventListener('scroll', handleScroll);
    }

    scrollElement.addEventListener('scroll', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [loadMoreLogs, range, rows, scrollElement, sortOrder]);

  return <>{children}</>;
};

function shouldLoadMore(element: HTMLDivElement, sortOrder: LogsSortOrder) {
  const delta = 1;
  // Oldest logs on top: scrollTop near 0
  // Oldest logs at the bottom: scrollTop near scroll limit
  const diff =
    sortOrder === LogsSortOrder.Ascending
      ? element.scrollTop
      : element.scrollHeight - element.scrollTop - element.clientHeight;
  return diff <= delta;
}

function getVisibleRange(rows: LogRowModel[]) {
  const firstTimeStamp = rows[0].timeEpochMs;
  const lastTimeStamp = rows[rows.length - 1].timeEpochMs;

  const visibleRange =
    lastTimeStamp < firstTimeStamp
      ? { from: lastTimeStamp, to: firstTimeStamp }
      : { from: firstTimeStamp, to: lastTimeStamp };

  return visibleRange;
}

function getNextRange(visibleRange: AbsoluteTimeRange, currentRange: TimeRange) {
  return { from: currentRange.from.valueOf(), to: visibleRange.from };
}
