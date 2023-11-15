import React, { ReactNode, useEffect } from 'react';

import { AbsoluteTimeRange, LogRowModel } from '@grafana/data';
import { LogsSortOrder } from '@grafana/schema';

type Props = {
  children: ReactNode;
  loading: boolean;
  loadMoreLogs?: (range: AbsoluteTimeRange) => void;
  range: AbsoluteTimeRange;
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
      if (!scrollElement || !loadMoreLogs || !rows.length || !shouldLoadMore(scrollElement)) {
        return;
      }
      loadMoreLogs(getNextRange(getVisibleRange(rows), range, sortOrder));

      scrollElement?.removeEventListener('scroll', handleScroll);
    }
    scrollElement.addEventListener('scroll', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [loadMoreLogs, range, rows, scrollElement, sortOrder]);

  return <>{children}</>;
};

function shouldLoadMore(element: HTMLDivElement) {
  const delta = 5;
  const diff = element.scrollHeight - element.scrollTop - element.clientHeight;
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

function getNextRange(visibleRange: AbsoluteTimeRange, currentRange: AbsoluteTimeRange, sortOrder: LogsSortOrder) {
  const rangeSpan = currentRange.to - currentRange.from;
  return sortOrder === LogsSortOrder.Descending
    ? { from: visibleRange.from - rangeSpan, to: visibleRange.from }
    : { from: visibleRange.to, to: visibleRange.to + rangeSpan };
}
