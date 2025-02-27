import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeList } from 'react-window';

import {
  AbsoluteTimeRange,
  CoreApp,
  DataFrame,
  EventBus,
  Field,
  LinkModel,
  LogRowModel,
  LogsSortOrder,
  TimeRange,
} from '@grafana/data';
import { PopoverContent, useTheme2 } from '@grafana/ui';

import { InfiniteScroll } from './InfiniteScroll';
import { getGridTemplateColumns } from './LogLine';
import { GetRowContextQueryFn } from './LogLineMenu';
import { LogListContext } from './LogListContext';
import { preProcessLogs, LogListModel, calculateFieldDimensions, LogFieldDimension } from './processing';
import {
  getLogLineSize,
  init as initVirtualization,
  resetLogLineSizes,
  ScrollToLogsEvent,
  storeLogLineSize,
} from './virtualization';

export type GetFieldLinksFn = (field: Field, rowIndex: number, dataFrame: DataFrame) => Array<LinkModel<Field>>;

interface Props {
  app: CoreApp;
  containerElement: HTMLDivElement;
  displayedFields: string[];
  eventBus: EventBus;
  forceEscape?: boolean;
  getFieldLinks?: GetFieldLinksFn;
  getRowContextQuery?: GetRowContextQueryFn;
  initialScrollPosition?: 'top' | 'bottom';
  loadMore?: (range: AbsoluteTimeRange) => void;
  logs: LogRowModel[];
  logSupportsContext?: (row: LogRowModel) => boolean;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  showTime: boolean;
  sortOrder: LogsSortOrder;
  timeRange: TimeRange;
  timeZone: string;
  wrapLogMessage: boolean;
}

export const LogList = ({
  app,
  containerElement,
  displayedFields = [],
  eventBus,
  forceEscape = false,
  getFieldLinks,
  initialScrollPosition = 'top',
  loadMore,
  logs,
  showTime,
  sortOrder,
  timeRange,
  timeZone,
  wrapLogMessage,
  ...logListContext
}: Props) => {
  const [processedLogs, setProcessedLogs] = useState<LogListModel[]>([]);
  const [listHeight, setListHeight] = useState(
    app === CoreApp.Explore ? window.innerHeight * 0.75 : containerElement.clientHeight
  );
  const theme = useTheme2();
  const listRef = useRef<VariableSizeList | null>(null);
  const widthRef = useRef(containerElement.clientWidth);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useMemo(
    () => (wrapLogMessage ? [] : calculateFieldDimensions(processedLogs, displayedFields)),
    [displayedFields, processedLogs, wrapLogMessage]
  );
  const styles = getStyles(dimensions, { showTime });

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
    setProcessedLogs(
      preProcessLogs(logs, { getFieldLinks, wrap: wrapLogMessage, escape: forceEscape, order: sortOrder, timeZone })
    );
    listRef.current?.resetAfterIndex(0);
  }, [forceEscape, getFieldLinks, logs, sortOrder, timeZone, wrapLogMessage]);

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
    <LogListContext.Provider value={logListContext}>
      <InfiniteScroll
        displayedFields={displayedFields}
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
            className={styles.logList}
            height={listHeight}
            itemCount={itemCount}
            itemSize={getLogLineSize.bind(null, processedLogs, containerElement, displayedFields, {
              wrap: wrapLogMessage,
              showTime,
            })}
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
    </LogListContext.Provider>
  );
};

function getStyles(dimensions: LogFieldDimension[], { showTime }: { showTime: boolean }) {
  const columns = showTime ? dimensions : dimensions.filter((_, index) => index > 0);
  return {
    logList: css({
      '& .unwrapped-log-line': {
        display: 'grid',
        gridTemplateColumns: getGridTemplateColumns(columns),
      },
    }),
  };
}

function handleScrollToEvent(event: ScrollToLogsEvent, logsCount: number, list: VariableSizeList | null) {
  if (event.payload.scrollTo === 'top') {
    list?.scrollTo(0);
  } else {
    list?.scrollToItem(logsCount - 1);
  }
}
