import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { Grammar } from 'prismjs';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { VariableSizeList } from 'react-window';

import {
  AbsoluteTimeRange,
  CoreApp,
  DataFrame,
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
import { LogLineDetails } from './LogLineDetails';
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

export interface Props {
  app: CoreApp;
  containerElement: HTMLDivElement;
  dedupStrategy: LogsDedupStrategy;
  displayedFields: string[];
  enableLogDetails: boolean;
  eventBus?: EventBus;
  filterLevels?: LogLevel[];
  getFieldLinks?: GetFieldLinksFn;
  getRowContextQuery?: GetRowContextQueryFn;
  grammar?: Grammar;
  initialScrollPosition?: 'top' | 'bottom';
  isLabelFilterActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  loading?: boolean;
  loadMore?: (range: AbsoluteTimeRange) => void;
  logOptionsStorageKey?: string;
  logs: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logSupportsContext?: (row: LogRowModel) => boolean;
  onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
  onClickFilterString?: (value: string, refId?: string) => void;
  onClickFilterOutString?: (value: string, refId?: string) => void;
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
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
  timeRange: TimeRange;
  timeZone: string;
  syntaxHighlighting?: boolean;
  wrapLogMessage: boolean;
}

export type LogListControlOptions = LogListState;

type LogListComponentProps = Omit<
  Props,
  | 'app'
  | 'dedupStrategy'
  | 'displayedFields'
  | 'enableLogDetails'
  | 'showTime'
  | 'sortOrder'
  | 'syntaxHighlighting'
  | 'wrapLogMessage'
>;

export const LogList = ({
  app,
  displayedFields,
  containerElement,
  dedupStrategy,
  enableLogDetails,
  eventBus,
  filterLevels,
  getFieldLinks,
  getRowContextQuery,
  grammar,
  initialScrollPosition = 'top',
  isLabelFilterActive,
  loading,
  loadMore,
  logOptionsStorageKey,
  logs,
  logsMeta,
  logSupportsContext,
  onClickFilterLabel,
  onClickFilterOutLabel,
  onClickFilterString,
  onClickFilterOutString,
  onClickShowField,
  onClickHideField,
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
      containerElement={containerElement}
      dedupStrategy={dedupStrategy}
      displayedFields={displayedFields}
      enableLogDetails={enableLogDetails}
      filterLevels={filterLevels}
      getRowContextQuery={getRowContextQuery}
      isLabelFilterActive={isLabelFilterActive}
      logs={logs}
      logsMeta={logsMeta}
      logOptionsStorageKey={logOptionsStorageKey}
      logSupportsContext={logSupportsContext}
      onClickFilterLabel={onClickFilterLabel}
      onClickFilterOutLabel={onClickFilterOutLabel}
      onClickFilterString={onClickFilterString}
      onClickFilterOutString={onClickFilterOutString}
      onClickShowField={onClickShowField}
      onClickHideField={onClickHideField}
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
  const {
    app,
    displayedFields,
    dedupStrategy,
    filterLevels,
    forceEscape,
    showDetails,
    showTime,
    sortOrder,
    toggleDetails,
    wrapLogMessage,
  } = useLogListContext();
  const [processedLogs, setProcessedLogs] = useState<LogListModel[]>([]);
  const [listHeight, setListHeight] = useState(
    app === CoreApp.Explore ? window.innerHeight * 0.75 : containerElement.clientHeight
  );
  const theme = useTheme2();
  const listRef = useRef<VariableSizeList | null>(null);
  const widthRef = useRef(containerElement.clientWidth);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dimensions = useMemo(
    () => (wrapLogMessage ? [] : calculateFieldDimensions(processedLogs, displayedFields)),
    [displayedFields, processedLogs, wrapLogMessage]
  );
  const styles = getStyles(dimensions, { showTime });
  const widthContainer = wrapperRef.current ?? containerElement;

  const debouncedResetAfterIndex = useMemo(() => {
    return debounce((index: number) => {
      listRef.current?.resetAfterIndex(index);
      overflowIndexRef.current = Infinity;
    }, 25);
  }, []);

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
    resetLogLineSizes();
    listRef.current?.resetAfterIndex(0);
  }, [forceEscape, getFieldLinks, grammar, loading, logs, sortOrder, timeZone]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [wrapLogMessage, showDetails, displayedFields]);

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
    if (widthRef.current === widthContainer.clientWidth) {
      return;
    }
    widthRef.current = widthContainer.clientWidth;
    debouncedResetAfterIndex(0);
  });

  const overflowIndexRef = useRef(Infinity);
  const handleOverflow = useCallback(
    (index: number, id: string, height?: number) => {
      if (height !== undefined) {
        storeLogLineSize(id, widthContainer, height);
      }
      overflowIndexRef.current = index < overflowIndexRef.current ? index : overflowIndexRef.current;
      debouncedResetAfterIndex(overflowIndexRef.current);
    },
    [debouncedResetAfterIndex, widthContainer]
  );

  const handleScrollPosition = useCallback(() => {
    listRef.current?.scrollToItem(initialScrollPosition === 'top' ? 0 : logs.length - 1);
  }, [initialScrollPosition, logs.length]);

  if (!containerElement || listHeight == null) {
    // Wait for container to be rendered
    return null;
  }

  const handleLogLineClick = useCallback(
    (log: LogListModel) => {
      toggleDetails(log);
    },
    [toggleDetails]
  );

  const handleLogDetailsResize = useCallback(() => {
    debouncedResetAfterIndex(0);
  }, [debouncedResetAfterIndex]);

  const filteredLogs = useMemo(
    () =>
      filterLevels.length === 0 ? processedLogs : processedLogs.filter((log) => filterLevels.includes(log.logLevel)),
    [filterLevels, processedLogs]
  );

  return (
    <div className={styles.logListContainer}>
      <div className={styles.logListWrapper} ref={wrapperRef}>
        <InfiniteScroll
          displayedFields={displayedFields}
          handleOverflow={handleOverflow}
          logs={filteredLogs}
          loadMore={loadMore}
          onClick={handleLogLineClick}
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
              itemSize={getLogLineSize.bind(null, filteredLogs, widthContainer, displayedFields, {
                showDuplicates: dedupStrategy !== LogsDedupStrategy.none,
                showTime,
                wrap: wrapLogMessage,
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
      </div>
      {showDetails.length > 0 && (
        <LogLineDetails
          containerElement={containerElement}
          getFieldLinks={getFieldLinks}
          logs={filteredLogs}
          onResize={handleLogDetailsResize}
        />
      )}
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
    logListWrapper: css({
      width: '100%',
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
