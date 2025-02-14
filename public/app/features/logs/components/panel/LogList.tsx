import { debounce } from 'lodash';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { VariableSizeList } from 'react-window';

import { AbsoluteTimeRange, CoreApp, EventBus, LogRowModel, LogsSortOrder, TimeRange } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { InfiniteScroll } from './InfiniteScroll';
import { preProcessLogs, LogListModel } from './processing';
import {
  getLogLineSize,
  init as initVirtualization,
  resetLogLineSizes,
  ScrollToLogsEvent,
  storeLogLineSize,
} from './virtualization';

interface Props {
  app: CoreApp;
  logs: LogRowModel[];
  containerElement: HTMLDivElement;
  eventBus: EventBus;
  forceEscape?: boolean;
  initialScrollPosition?: 'top' | 'bottom';
  loadMore?: (range: AbsoluteTimeRange) => void;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  timeRange: TimeRange;
  timeZone: string;
  wrapLogMessage: boolean;
}

export const LogList = ({
  app,
  containerElement,
  eventBus,
  forceEscape = false,
  initialScrollPosition = 'top',
  loadMore,
  logs,
  showTime,
  sortOrder,
  timeRange,
  timeZone,
  wrapLogMessage,
}: Props) => {
  const [processedLogs, setProcessedLogs] = useState<LogListModel[]>([]);
  const [listHeight, setListHeight] = useState(
    app === CoreApp.Explore ? window.innerHeight * 0.75 : containerElement.clientHeight
  );
  const theme = useTheme2();
  const listRef = useRef<VariableSizeList | null>(null);
  const widthRef = useRef(containerElement.clientWidth);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initVirtualization(theme);
  }, [theme]);

  useEffect(() => {
    const subscription = eventBus.subscribe(ScrollToLogsEvent, (e: ScrollToLogsEvent) =>
      handleScrollToEvent(e, logs.length, listRef.current)
    );
    return () => subscription.unsubscribe();
  }, [eventBus, logs.length]);

  useEffect(() => {
    setProcessedLogs(preProcessLogs(logs, { wrap: wrapLogMessage, escape: forceEscape, order: sortOrder, timeZone }));
    listRef.current?.resetAfterIndex(0);
  }, [forceEscape, logs, sortOrder, timeZone, wrapLogMessage]);

  useEffect(() => {
    const handleResize = debounce(() => {
      setListHeight(app === CoreApp.Explore ? window.innerHeight * 0.75 : containerElement.clientHeight);
    }, 50);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [app, containerElement.clientHeight]);

  useLayoutEffect(() => {
    if (widthRef.current === containerElement.clientWidth) {
      return;
    }
    resetLogLineSizes();
    listRef.current?.resetAfterIndex(0);
    widthRef.current = containerElement.clientWidth;
  });

  const handleOverflow = useCallback(
    (index: number, id: string, height: number) => {
      if (containerElement) {
        storeLogLineSize(id, containerElement, height);
        listRef.current?.resetAfterIndex(index);
      }
    },
    [containerElement]
  );

  const handleScrollPosition = useCallback(() => {
    listRef.current?.scrollToItem(initialScrollPosition === 'top' ? 0 : logs.length - 1);
  }, [initialScrollPosition, logs.length]);

  if (!containerElement || listHeight == null) {
    // Wait for container to be rendered
    return null;
  }

  return (
    <InfiniteScroll
      handleOverflow={handleOverflow}
      logs={processedLogs}
      loadMore={loadMore}
      scrollElement={scrollRef.current}
      showTime={showTime}
      sortOrder={sortOrder}
      timeRange={timeRange}
      timeZone={timeZone}
      setInitialScrollPosition={handleScrollPosition}
      wrapLogMessage={wrapLogMessage}
    >
      {({ getItemKey, itemCount, onItemsRendered, Renderer }) => (
        <VariableSizeList
          height={listHeight}
          itemCount={itemCount}
          itemSize={getLogLineSize.bind(null, processedLogs, containerElement, { wrap: wrapLogMessage, showTime })}
          itemKey={getItemKey}
          layout="vertical"
          onItemsRendered={onItemsRendered}
          outerRef={scrollRef}
          ref={listRef}
          style={{ overflowY: 'scroll' }}
          width="100%"
        >
          {Renderer}
        </VariableSizeList>
      )}
    </InfiniteScroll>
  );
};

function handleScrollToEvent(event: ScrollToLogsEvent, logsCount: number, list: VariableSizeList | null) {
  if (event.payload.scrollTo === 'top') {
    list?.scrollTo(0);
  } else {
    list?.scrollToItem(logsCount - 1);
  }
}
