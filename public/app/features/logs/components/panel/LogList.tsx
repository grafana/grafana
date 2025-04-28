import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { Grammar } from 'prismjs';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeList } from 'react-window';

import {
  AbsoluteTimeRange,
  CoreApp,
  EventBus,
  EventBusSrv,
  LogLevel,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaItem,
  LogsSortOrder,
  store,
  TimeRange,
} from '@grafana/data';
import { PopoverContent, useTheme2 } from '@grafana/ui';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { InfiniteScroll } from './InfiniteScroll';
import { getGridTemplateColumns } from './LogLine';
import { GetRowContextQueryFn } from './LogLineMenu';
import { LogListContextProvider, LogListState, useLogListContext } from './LogListContext';
import { LogListControls } from './LogListControls';
import { preProcessLogs, LogListModel } from './processing';
import {
  calculateFieldDimensions,
  getLogLineSize,
  init as initVirtualization,
  LogFieldDimension,
  resetLogLineSizes,
  ScrollToLogsEvent,
  storeLogLineSize,
} from './virtualization';

interface Props {
  app: CoreApp;
  containerElement: HTMLDivElement;
  dedupStrategy: LogsDedupStrategy;
  displayedFields: string[];
  eventBus?: EventBus;
  filterLevels?: LogLevel[];
  getFieldLinks?: GetFieldLinksFn;
  getRowContextQuery?: GetRowContextQueryFn;
  grammar?: Grammar;
  initialScrollPosition?: 'top' | 'bottom';
  loading?: boolean;
  loadMore?: (range: AbsoluteTimeRange) => void;
  logOptionsStorageKey?: string;
  logs: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logSupportsContext?: (row: LogRowModel) => boolean;
  onLogOptionsChange?: (option: keyof LogListControlOptions, value: string | boolean | string[]) => void;
  onLogLineHover?: (row?: LogRowModel) => void;
  onPermalinkClick?: (row: LogRowModel) => Promise<void>;
  onPinLine?: (row: LogRowModel) => void;
  onOpenContext?: (row: LogRowModel, onClose: () => void) => void;
  onUnpinLine?: (row: LogRowModel) => void;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  showControls: boolean;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  storageKey?: string;
  timeRange: TimeRange;
  timeZone: string;
  syntaxHighlighting?: boolean;
  wrapLogMessage: boolean;
}

export type LogListControlOptions = LogListState;

type LogListComponentProps = Omit<
  Props,
  'app' | 'dedupStrategy' | 'displayedFields' | 'showTime' | 'sortOrder' | 'syntaxHighlighting' | 'wrapLogMessage'
>;

export const LogList = ({
  app,
  displayedFields,
  containerElement,
  dedupStrategy,
  eventBus,
  filterLevels,
  getFieldLinks,
  getRowContextQuery,
  grammar,
  initialScrollPosition = 'top',
  loading,
  loadMore,
  logOptionsStorageKey,
  logs,
  logsMeta,
  logSupportsContext,
  onLogOptionsChange,
  onLogLineHover,
  onPermalinkClick,
  onPinLine,
  onOpenContext,
  onUnpinLine,
  pinLineButtonTooltipTitle,
  pinnedLogs,
  showControls,
  showTime,
  sortOrder,
  syntaxHighlighting = logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.syntaxHighlighting`, true) : true,
  timeRange,
  timeZone,
  wrapLogMessage,
}: Props) => {
  return (
    <LogListContextProvider
      app={app}
      dedupStrategy={dedupStrategy}
      displayedFields={displayedFields}
      filterLevels={filterLevels}
      getRowContextQuery={getRowContextQuery}
      logs={logs}
      logsMeta={logsMeta}
      logOptionsStorageKey={logOptionsStorageKey}
      logSupportsContext={logSupportsContext}
      onLogOptionsChange={onLogOptionsChange}
      onLogLineHover={onLogLineHover}
      onPermalinkClick={onPermalinkClick}
      onPinLine={onPinLine}
      onOpenContext={onOpenContext}
      onUnpinLine={onUnpinLine}
      pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
      pinnedLogs={pinnedLogs}
      showControls={showControls}
      showTime={showTime}
      sortOrder={sortOrder}
      syntaxHighlighting={syntaxHighlighting}
      wrapLogMessage={wrapLogMessage}
    >
      <LogListComponent
        containerElement={containerElement}
        eventBus={eventBus}
        getFieldLinks={getFieldLinks}
        grammar={grammar}
        initialScrollPosition={initialScrollPosition}
        loading={loading}
        loadMore={loadMore}
        logs={logs}
        showControls={showControls}
        timeRange={timeRange}
        timeZone={timeZone}
      />
    </LogListContextProvider>
  );
};

const LogListComponent = ({
  containerElement,
  eventBus = new EventBusSrv(),
  getFieldLinks,
  grammar,
  initialScrollPosition = 'top',
  loading,
  loadMore,
  logs,
  showControls,
  timeRange,
  timeZone,
}: LogListComponentProps) => {
  const { app, displayedFields, filterLevels, forceEscape, showTime, sortOrder, wrapLogMessage } = useLogListContext();
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
    if (loading) {
      return;
    }
    setProcessedLogs(
      preProcessLogs(logs, { getFieldLinks, escape: forceEscape ?? false, order: sortOrder, timeZone }, grammar)
    );
    listRef.current?.resetAfterIndex(0);
  }, [forceEscape, getFieldLinks, grammar, loading, logs, sortOrder, timeZone]);

  useEffect(() => {
    resetLogLineSizes();
    listRef.current?.resetAfterIndex(0);
  }, [wrapLogMessage, processedLogs]);

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
    (index: number, id: string, height?: number) => {
      if (containerElement && height !== undefined) {
        storeLogLineSize(id, containerElement, height);
      }
      listRef.current?.resetAfterIndex(index);
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

  const filteredLogs = useMemo(
    () =>
      filterLevels.length === 0 ? processedLogs : processedLogs.filter((log) => filterLevels.includes(log.logLevel)),
    [filterLevels, processedLogs]
  );

  return (
    <div className={styles.logListContainer}>
      <InfiniteScroll
        displayedFields={displayedFields}
        handleOverflow={handleOverflow}
        logs={filteredLogs}
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
            itemSize={getLogLineSize.bind(null, filteredLogs, containerElement, displayedFields, {
              wrap: wrapLogMessage,
              showControls,
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
      {showControls && <LogListControls eventBus={eventBus} />}
    </div>
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
    logListContainer: css({
      display: 'flex',
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
