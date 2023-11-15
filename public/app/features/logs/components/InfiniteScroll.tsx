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
  sortOrder: LogsSortOrder | null;
};

export const InfiniteScroll = ({ children, loadMoreLogs, range, rows, scrollElement }: Props) => {
  useEffect(() => {
    if (!scrollElement || !loadMoreLogs) {
      return;
    }
    const delta = 5;
    function handleScroll(e: Event) {
      if (!e.target || !loadMoreLogs || !rows.length) {
        return;
      }
      const target: HTMLDivElement = e.target as HTMLDivElement;
      const diff = target.scrollHeight - target.scrollTop - target.clientHeight;
      if (diff > delta) {
        return;
      }

      const firstTimeStamp = rows[0].timeEpochMs;
      const lastTimeStamp = rows[rows.length - 1].timeEpochMs;

      const visibleRange =
        lastTimeStamp < firstTimeStamp
          ? { from: lastTimeStamp, to: firstTimeStamp }
          : { from: firstTimeStamp, to: lastTimeStamp };
      const rangeSpan = range.to - range.from;
      loadMoreLogs({ from: visibleRange.from - rangeSpan, to: visibleRange.from });

      scrollElement?.removeEventListener('scroll', handleScroll);
    }
    scrollElement.addEventListener('scroll', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [loadMoreLogs, range.from, range.to, rows, scrollElement]);

  return <>{children}</>;
};
