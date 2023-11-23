import { css } from '@emotion/css';
import React, { ReactNode, useEffect, useState } from 'react';

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

export const InfiniteScroll = ({ children, loading, loadMoreLogs, range, rows, scrollElement, sortOrder }: Props) => {
  const [lowerOutOfRange, setLowerOutOfRange] = useState(false);
  const [upperOutOfRange, setUpperOutOfRange] = useState(false);
  const [lastScroll, setLastScroll] = useState(scrollElement?.scrollTop || 0);

  useEffect(() => {
    if (!scrollElement || !loadMoreLogs) {
      return;
    }

    function handleScroll(e: Event) {
      if (!scrollElement || !loadMoreLogs || !rows.length || loading) {
        return;
      }
      e.stopImmediatePropagation();
      setLastScroll(scrollElement.scrollTop);
      const scrollDirection = shouldLoadMore(scrollElement, lastScroll);
      if (scrollDirection === ScrollDirection.NoScroll) {
        return;
      } else if (scrollDirection === ScrollDirection.Top) {
        scrollTop();
      } else {
        scrollBottom();
      }
    }

    function scrollTop() {
      if (!canScrollTop(getVisibleRange(rows), range, sortOrder)) {
        setUpperOutOfRange(true);
        return;
      }
      const newRange = sortOrder === LogsSortOrder.Descending ? getNextRange(getVisibleRange(rows), range) : getPrevRange(getVisibleRange(rows), range);
      loadMoreLogs?.(newRange);
    };
  
    function scrollBottom() {
      if (!canScrollBottom(getVisibleRange(rows), range, sortOrder)) {
        setLowerOutOfRange(true);
        return;
      }
      const newRange = sortOrder === LogsSortOrder.Descending ? getPrevRange(getVisibleRange(rows), range) : getNextRange(getVisibleRange(rows), range);
      loadMoreLogs?.(newRange);
    }

    scrollElement.addEventListener('scroll', handleScroll);
    scrollElement.addEventListener('wheel', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('wheel', handleScroll);
    };
  }, [loadMoreLogs, range, rows, scrollElement, sortOrder, loading, lastScroll]);

  return (
    <>
      {upperOutOfRange && outOfRangeMessage}
      {children}
      {lowerOutOfRange && outOfRangeMessage}
    </>
  );
};

const styles = {
  limitReached: css({
    textAlign: 'center',
    padding: 0.25,
  })
}

const outOfRangeMessage = <div className={styles.limitReached}>Limit reached for the current time range.</div>;

enum ScrollDirection {
  Top = -1,
  Bottom = 1,
  NoScroll = 0
}
function shouldLoadMore(element: HTMLDivElement, lastScroll: number): ScrollDirection {
  const delta = element.scrollTop - lastScroll;
  const scrollDirection = delta <= 0 ? ScrollDirection.Top : ScrollDirection.Bottom;
  const diff = scrollDirection === ScrollDirection.Top ? 
    element.scrollTop :
    element.scrollHeight - element.scrollTop - element.clientHeight;
  const coef = 1;
  
  return diff <= coef ? scrollDirection : ScrollDirection.NoScroll;
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

function getPrevRange(visibleRange: AbsoluteTimeRange, currentRange: TimeRange) {
  return { from: currentRange.from.valueOf(), to: visibleRange.from };
}

function getNextRange(visibleRange: AbsoluteTimeRange, currentRange: TimeRange) {
  return { from: visibleRange.to, to: currentRange.to.valueOf() };
}

function canScrollTop(visibleRange: AbsoluteTimeRange, currentRange: TimeRange, sortOrder: LogsSortOrder) {
  return true;
  //return sortOrder === LogsSortOrder.Descending ? visibleRange.to < currentRange.to.valueOf() : visibleRange.from > currentRange.from.valueOf();
}

function canScrollBottom(visibleRange: AbsoluteTimeRange, currentRange: TimeRange, sortOrder: LogsSortOrder) {
  return true;
  //return sortOrder === LogsSortOrder.Descending ? visibleRange.from < currentRange.from.valueOf() : visibleRange.to < currentRange.to.valueOf();
}
