import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ListChildComponentProps } from 'react-window';

import { AbsoluteTimeRange, CoreApp, EventBus, LogsSortOrder, TimeRange } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Spinner } from '@grafana/ui';

import { canScrollBottom, getVisibleRange, ScrollDirection, shouldLoadMore } from '../InfiniteScroll';

import { LogLine } from './LogLine';
import { LogLineMessage } from './LogLineMessage';
import { ProcessedLogModel } from './processing';
import { ScrollToLogsEvent } from './virtualization';

interface ChildrenProps {
  itemCount: number;
  getItemKey: (index: number) => string;
  Renderer: (props: ListChildComponentProps) => ReactNode;
}

interface Props {
  app: CoreApp;
  children: (props: ChildrenProps) => ReactNode;
  eventBus: EventBus;
  handleOverflow: (index: number, id: string, height: number) => void;
  loadMore?: (range: AbsoluteTimeRange) => void;
  logs: ProcessedLogModel[];
  scrollElement: HTMLDivElement | null;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  timeRange: TimeRange;
  timeZone: string;
  wrapLogMessage: boolean;
}

type InfiniteLoaderState = 'idle' | 'out-of-bounds' | 'loading';

export const InfiniteScroll = ({
  app,
  children,
  eventBus,
  handleOverflow,
  loadMore,
  logs,
  scrollElement,
  showTime,
  sortOrder,
  timeRange,
  timeZone,
  wrapLogMessage,
}: Props) => {
  const [infiniteLoaderState, setInfiniteLoaderState] = useState<InfiniteLoaderState>('idle');
  const prevLogsRef = useRef(logs);
  const lastScroll = useRef<number>(scrollElement?.scrollTop || 0);
  const lastEvent = useRef<Event | WheelEvent | null>(null);
  const countRef = useRef(0);

  useEffect(() => {
    // Logs have not changed, ignore effect
    if (prevLogsRef.current === logs) {
      return;
    }
    const prevLogs = prevLogsRef.current;
    prevLogsRef.current = logs;

    // New logs are from infinite scrolling
    if (infiniteLoaderState === 'loading') {
      // No new logs returned
      if (logs.length === prevLogs.length) {
        setInfiniteLoaderState('out-of-bounds');
      } else {
        setInfiniteLoaderState('idle');
      }
      return;
    }

    /**
     * In dashboards, users with newest logs at the bottom have the expectation of keeping the scroll at the bottom
     * when new data is received. See https://github.com/grafana/grafana/pull/37634
     */
    const isDashboard = app === CoreApp.Dashboard || app === CoreApp.PanelEditor;
    eventBus.publish(
      new ScrollToLogsEvent({
        scrollTo: isDashboard && sortOrder === LogsSortOrder.Ascending ? 'bottom' : 'top',
      })
    );
  }, [app, eventBus, infiniteLoaderState, logs, sortOrder]);

  useEffect(() => {
    if (!scrollElement || !loadMore || !config.featureToggles.logsInfiniteScrolling) {
      return;
    }

    function handleScroll(event: Event | WheelEvent) {
      if (!scrollElement || !loadMore || !logs.length || infiniteLoaderState === 'loading') {
        return;
      }
      const scrollDirection = shouldLoadMore(event, lastEvent.current, countRef, scrollElement, lastScroll.current);
      lastEvent.current = event;
      lastScroll.current = scrollElement.scrollTop;
      if (scrollDirection === ScrollDirection.Bottom) {
        scrollBottom();
      }
    }

    function scrollBottom() {
      const newRange = canScrollBottom(getVisibleRange(logs), timeRange, timeZone, sortOrder);
      if (!newRange) {
        setInfiniteLoaderState('out-of-bounds');
        return;
      }
      setInfiniteLoaderState('loading');
      loadMore?.(newRange);

      reportInteraction('grafana_logs_infinite_scrolling', {
        direction: 'bottom',
        sort_order: sortOrder,
      });
    }

    scrollElement.addEventListener('scroll', handleScroll);
    scrollElement.addEventListener('wheel', handleScroll);

    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
      scrollElement.removeEventListener('wheel', handleScroll);
    };
  }, [infiniteLoaderState, loadMore, logs, scrollElement, sortOrder, timeRange, timeZone]);

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

  const getItemKey = useCallback((index: number) => (logs[index] ? logs[index].uid : index.toString()), [logs]);

  const itemCount = logs.length && loadMore ? logs.length + 1 : logs.length;

  return <>{children({ getItemKey, itemCount, Renderer })}</>;
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
    case 'idle':
      return 'Scroll to load more';
    default:
      return null;
  }
}
