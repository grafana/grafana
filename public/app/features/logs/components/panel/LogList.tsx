import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { Grammar } from 'prismjs';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, MouseEvent } from 'react';
import { Align, VariableSizeList } from 'react-window';

import {
  CoreApp,
  DataFrame,
  EventBus,
  EventBusSrv,
  GrafanaTheme2,
  LogLevel,
  LogRowModel,
  LogsDedupStrategy,
  LogsMetaItem,
  LogsSortOrder,
  store,
  TimeRange,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { ConfirmModal, Icon, PopoverContent, useStyles2, useTheme2 } from '@grafana/ui';
import { PopoverMenu } from 'app/features/explore/Logs/PopoverMenu';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { InfiniteScrollMode, InfiniteScroll, LoadMoreLogsType } from './InfiniteScroll';
import { getGridTemplateColumns, LogLineTimestampResolution } from './LogLine';
import { LogLineDetails, LogLineDetailsMode } from './LogLineDetails';
import { GetRowContextQueryFn, LogLineMenuCustomItem } from './LogLineMenu';
import { LogListContextProvider, LogListState, useLogListContext } from './LogListContext';
import { LogListControls } from './LogListControls';
import { LOG_LIST_SEARCH_HEIGHT, LogListSearch } from './LogListSearch';
import { LogListSearchContextProvider, useLogListSearchContext } from './LogListSearchContext';
import { preProcessLogs, LogListModel } from './processing';
import { useKeyBindings } from './useKeyBindings';
import { usePopoverMenu } from './usePopoverMenu';
import { LogLineVirtualization, getLogLineSize, LogFieldDimension, ScrollToLogsEvent } from './virtualization';

export interface Props {
  app: CoreApp;
  containerElement: HTMLDivElement;
  dedupStrategy: LogsDedupStrategy;
  detailsMode?: LogLineDetailsMode;
  displayedFields: string[];
  enableLogDetails: boolean;
  eventBus?: EventBus;
  filterLevels?: LogLevel[];
  fontSize?: LogListFontSize;
  getFieldLinks?: GetFieldLinksFn;
  getRowContextQuery?: GetRowContextQueryFn;
  grammar?: Grammar;
  infiniteScrollMode?: InfiniteScrollMode;
  initialScrollPosition?: 'top' | 'bottom';
  isLabelFilterActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  loading?: boolean;
  loadMore?: LoadMoreLogsType;
  logLineMenuCustomItems?: LogLineMenuCustomItem[];
  logOptionsStorageKey?: string;
  logs: LogRowModel[];
  logsMeta?: LogsMetaItem[];
  logSupportsContext?: (row: LogRowModel) => boolean;
  noInteractions?: boolean;
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
  permalinkedLogId?: string;
  pinLineButtonTooltipTitle?: PopoverContent;
  pinnedLogs?: string[];
  setDisplayedFields?: (displayedFields: string[]) => void;
  showControls: boolean;
  showTime: boolean;
  sortOrder: LogsSortOrder;
  timeRange: TimeRange;
  timestampResolution?: LogLineTimestampResolution;
  timeZone: string;
  syntaxHighlighting?: boolean;
  wrapLogMessage: boolean;
}

export type LogListFontSize = 'default' | 'small';

export type LogListControlOptions = LogListState;

type LogListComponentProps = Omit<
  Props,
  | 'app'
  | 'dedupStrategy'
  | 'displayedFields'
  | 'enableLogDetails'
  | 'loading'
  | 'logOptionsStorageKey'
  | 'permalinkedLogId'
  | 'showTime'
  | 'sortOrder'
  | 'syntaxHighlighting'
  | 'wrapLogMessage'
>;

export const LogList = ({
  app,
  displayedFields,
  containerElement,
  logOptionsStorageKey,
  detailsMode = logOptionsStorageKey ? (store.get(`${logOptionsStorageKey}.detailsMode`) ?? 'sidebar') : 'sidebar',
  dedupStrategy,
  enableLogDetails,
  eventBus,
  filterLevels,
  fontSize = logOptionsStorageKey ? (store.get(`${logOptionsStorageKey}.fontSize`) ?? 'default') : 'default',
  getFieldLinks,
  getRowContextQuery,
  grammar,
  infiniteScrollMode,
  initialScrollPosition = 'top',
  isLabelFilterActive,
  loading,
  loadMore,
  logLineMenuCustomItems,
  logs,
  logsMeta,
  logSupportsContext,
  noInteractions,
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
  permalinkedLogId,
  pinLineButtonTooltipTitle,
  pinnedLogs,
  setDisplayedFields,
  showControls,
  showTime,
  sortOrder,
  syntaxHighlighting = logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.syntaxHighlighting`, true) : true,
  timeRange,
  timestampResolution,
  timeZone,
  wrapLogMessage,
}: Props) => {
  return (
    <LogListContextProvider
      app={app}
      containerElement={containerElement}
      dedupStrategy={dedupStrategy}
      detailsMode={detailsMode}
      displayedFields={displayedFields}
      enableLogDetails={enableLogDetails}
      filterLevels={filterLevels}
      fontSize={fontSize}
      getRowContextQuery={getRowContextQuery}
      isLabelFilterActive={isLabelFilterActive}
      logs={logs}
      logsMeta={logsMeta}
      logLineMenuCustomItems={logLineMenuCustomItems}
      logOptionsStorageKey={logOptionsStorageKey}
      logSupportsContext={logSupportsContext}
      noInteractions={noInteractions}
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
      permalinkedLogId={permalinkedLogId}
      pinLineButtonTooltipTitle={pinLineButtonTooltipTitle}
      pinnedLogs={pinnedLogs}
      setDisplayedFields={setDisplayedFields}
      showControls={showControls}
      showTime={showTime}
      sortOrder={sortOrder}
      syntaxHighlighting={syntaxHighlighting}
      timestampResolution={timestampResolution}
      wrapLogMessage={wrapLogMessage}
    >
      <LogListSearchContextProvider>
        <LogListComponent
          containerElement={containerElement}
          eventBus={eventBus}
          getFieldLinks={getFieldLinks}
          grammar={grammar}
          initialScrollPosition={initialScrollPosition}
          infiniteScrollMode={infiniteScrollMode}
          loadMore={loadMore}
          logs={logs}
          showControls={showControls}
          timeRange={timeRange}
          timeZone={timeZone}
        />
      </LogListSearchContextProvider>
    </LogListContextProvider>
  );
};

const LogListComponent = ({
  containerElement,
  eventBus = new EventBusSrv(),
  getFieldLinks,
  grammar,
  initialScrollPosition = 'top',
  infiniteScrollMode = 'interval',
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
    detailsMode,
    filterLevels,
    fontSize,
    forceEscape,
    hasLogsWithErrors,
    hasSampledLogs,
    onClickFilterString,
    onClickFilterOutString,
    permalinkedLogId,
    showDetails,
    showTime,
    sortOrder,
    timestampResolution,
    toggleDetails,
    wrapLogMessage,
  } = useLogListContext();
  const [processedLogs, setProcessedLogs] = useState<LogListModel[]>([]);
  const [listHeight, setListHeight] = useState(getListHeight(containerElement, app));
  const theme = useTheme2();
  const listRef = useRef<VariableSizeList | null>(null);
  const widthRef = useRef(containerElement.clientWidth);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualization = useMemo(() => new LogLineVirtualization(theme, fontSize), [theme, fontSize]);
  const dimensions = useMemo(
    () =>
      wrapLogMessage
        ? []
        : virtualization.calculateFieldDimensions(processedLogs, displayedFields, timestampResolution),
    [displayedFields, processedLogs, timestampResolution, virtualization, wrapLogMessage]
  );
  const styles = useStyles2(getStyles, dimensions, displayedFields, { showTime });
  const widthContainer = wrapperRef.current ?? containerElement;
  const {
    closePopoverMenu,
    handleTextSelection,
    onDisableCancel,
    onDisableConfirm,
    onDisablePopoverMenu,
    popoverState,
    showDisablePopoverOptions,
  } = usePopoverMenu(wrapperRef.current);
  useKeyBindings();
  const { filterLogs, matchingUids, searchVisible } = useLogListSearchContext();

  const levelFilteredLogs = useMemo(
    () =>
      filterLevels.length === 0 ? processedLogs : processedLogs.filter((log) => filterLevels.includes(log.logLevel)),
    [filterLevels, processedLogs]
  );

  const filteredLogs = useMemo(
    () =>
      matchingUids && filterLogs
        ? levelFilteredLogs.filter((log) => matchingUids.includes(log.uid))
        : levelFilteredLogs,
    [filterLogs, levelFilteredLogs, matchingUids]
  );

  const debouncedResetAfterIndex = useMemo(() => {
    return debounce((index: number) => {
      listRef.current?.resetAfterIndex(index);
      overflowIndexRef.current = Infinity;
    }, 25);
  }, []);

  const debouncedScrollToItem = useMemo(() => {
    return debounce((index: number, align?: Align) => {
      listRef.current?.scrollToItem(index, align);
    }, 250);
  }, []);

  useEffect(() => {
    const subscription = eventBus.subscribe(ScrollToLogsEvent, (e: ScrollToLogsEvent) =>
      handleScrollToEvent(e, filteredLogs, listRef.current)
    );
    return () => subscription.unsubscribe();
  }, [eventBus, filteredLogs]);

  useEffect(() => {
    setProcessedLogs(
      preProcessLogs(
        logs,
        { getFieldLinks, escape: forceEscape ?? false, order: sortOrder, timeZone, virtualization, wrapLogMessage },
        grammar
      )
    );
    virtualization.resetLogLineSizes();
    listRef.current?.resetAfterIndex(0);
  }, [forceEscape, getFieldLinks, grammar, logs, sortOrder, timeZone, virtualization, wrapLogMessage]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [wrapLogMessage, showDetails, displayedFields, dedupStrategy]);

  useLayoutEffect(() => {
    if (widthRef.current !== widthContainer.clientWidth) {
      widthRef.current = widthContainer.clientWidth;
      debouncedResetAfterIndex(0);
    }
  });

  useLayoutEffect(() => {
    const handleResize = debounce(() => {
      setListHeight(getListHeight(containerElement, app, searchVisible));
    }, 50);
    const observer = new ResizeObserver(() => handleResize());
    observer.observe(containerElement);
    return () => observer.disconnect();
  }, [app, containerElement, searchVisible]);

  const overflowIndexRef = useRef(Infinity);
  const handleOverflow = useCallback(
    (index: number, id: string, height?: number) => {
      if (height !== undefined) {
        virtualization.storeLogLineSize(id, widthContainer, height);
      }
      if (index === overflowIndexRef.current) {
        return;
      }
      overflowIndexRef.current = index < overflowIndexRef.current ? index : overflowIndexRef.current;
      debouncedResetAfterIndex(overflowIndexRef.current);
    },
    [debouncedResetAfterIndex, virtualization, widthContainer]
  );

  const handleScrollPosition = useCallback(
    (log?: LogListModel) => {
      const scrollToUID = log ? log.uid : permalinkedLogId;
      if (scrollToUID) {
        const index = processedLogs.findIndex((log) => log.uid === scrollToUID);
        if (index >= 0) {
          listRef.current?.scrollToItem(index, 'start');
          return;
        }
      }
      listRef.current?.scrollToItem(initialScrollPosition === 'top' ? 0 : processedLogs.length - 1);
    },
    [initialScrollPosition, permalinkedLogId, processedLogs]
  );

  if (!containerElement || listHeight == null) {
    // Wait for container to be rendered
    return null;
  }

  const handleLogLineClick = useCallback(
    (e: MouseEvent<HTMLElement>, log: LogListModel) => {
      if (handleTextSelection(e, log)) {
        // Event handled by the parent.
        return;
      }
      toggleDetails(log);
    },
    [handleTextSelection, toggleDetails]
  );

  const handleLogDetailsResize = useCallback(() => {
    debouncedResetAfterIndex(0);
  }, [debouncedResetAfterIndex]);

  const focusLogLine = useCallback(
    (log: LogListModel) => {
      const index = filteredLogs.indexOf(log);
      if (index >= 0) {
        debouncedScrollToItem(index, 'start');
      }
    },
    [debouncedScrollToItem, filteredLogs]
  );

  return (
    <div className={styles.logListContainer}>
      {showControls && <LogListControls eventBus={eventBus} />}
      {detailsMode === 'sidebar' && showDetails.length > 0 && (
        <LogLineDetails
          containerElement={containerElement}
          focusLogLine={focusLogLine}
          logs={filteredLogs}
          onResize={handleLogDetailsResize}
        />
      )}
      <div className={styles.logListWrapper} ref={wrapperRef}>
        {popoverState.selection && popoverState.selectedRow && (
          <PopoverMenu
            close={closePopoverMenu}
            row={popoverState.selectedRow}
            selection={popoverState.selection}
            {...popoverState.popoverMenuCoordinates}
            onClickFilterString={onClickFilterString}
            onClickFilterOutString={onClickFilterOutString}
            onDisable={onDisablePopoverMenu}
          />
        )}
        {showDisablePopoverOptions && (
          <ConfirmModal
            isOpen
            title={t('logs.log-rows.disable-popover.title', 'Disable menu')}
            body={
              <>
                <Trans i18nKey="logs.log-rows.disable-popover.message">
                  You are about to disable the logs filter menu. To re-enable it, select text in a log line while
                  holding the alt key.
                </Trans>
                <div className={styles.shortcut}>
                  <Icon name="keyboard" />
                  <Trans i18nKey="logs.log-rows.disable-popover-message.shortcut">alt+select to enable again</Trans>
                </div>
              </>
            }
            confirmText={t('logs.log-rows.disable-popover.confirm', 'Confirm')}
            icon="exclamation-triangle"
            onConfirm={onDisableConfirm}
            onDismiss={onDisableCancel}
          />
        )}
        <LogListSearch logs={levelFilteredLogs} listRef={listRef.current} />
        <InfiniteScroll
          displayedFields={displayedFields}
          handleOverflow={handleOverflow}
          infiniteScrollMode={infiniteScrollMode}
          loading={loading}
          logs={filteredLogs}
          loadMore={loadMore}
          onClick={handleLogLineClick}
          scrollElement={scrollRef.current}
          showTime={showTime}
          sortOrder={sortOrder}
          timeRange={timeRange}
          timeZone={timeZone}
          setInitialScrollPosition={handleScrollPosition}
          virtualization={virtualization}
          wrapLogMessage={wrapLogMessage}
        >
          {({ getItemKey, itemCount, onItemsRendered, Renderer }) => (
            <VariableSizeList
              className={styles.logList}
              height={listHeight}
              itemCount={itemCount}
              itemSize={getLogLineSize.bind(null, virtualization, filteredLogs, widthContainer, displayedFields, {
                detailsMode,
                hasLogsWithErrors,
                hasSampledLogs,
                showDuplicates: dedupStrategy !== LogsDedupStrategy.none,
                showDetails,
                showTime,
                wrap: wrapLogMessage,
              })}
              itemKey={getItemKey}
              layout="vertical"
              onItemsRendered={onItemsRendered}
              outerRef={scrollRef}
              overscanCount={5}
              ref={listRef}
              style={wrapLogMessage ? { overflowY: 'scroll' } : { overflow: 'scroll' }}
              width="100%"
            >
              {Renderer}
            </VariableSizeList>
          )}
        </InfiniteScroll>
      </div>
    </div>
  );
};

function getStyles(
  theme: GrafanaTheme2,
  dimensions: LogFieldDimension[],
  displayedFields: string[],
  { showTime }: { showTime: boolean }
) {
  const columns = showTime ? dimensions : dimensions.filter((_, index) => index > 0);
  return {
    logList: css({
      '& .unwrapped-log-line': {
        display: 'grid',
        gridTemplateColumns: getGridTemplateColumns(columns, displayedFields),
        '& .field': {
          overflow: 'hidden',
        },
      },
    }),
    logListContainer: css({
      display: 'flex',
      flexDirection: 'row-reverse',
      // Minimum width to prevent rendering issues and a sausage-like logs panel.
      minWidth: theme.spacing(35),
    }),
    logListWrapper: css({
      position: 'relative',
      width: '100%',
    }),
    shortcut: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      color: theme.colors.text.secondary,
      opacity: 0.7,
      fontSize: theme.typography.bodySmall.fontSize,
      marginTop: theme.spacing(1),
    }),
  };
}

function handleScrollToEvent(event: ScrollToLogsEvent, logs: LogListModel[], list: VariableSizeList | null) {
  if (event.payload.scrollTo === 'top') {
    list?.scrollTo(0);
  } else if (event.payload.scrollTo === 'bottom') {
    list?.scrollToItem(logs.length - 1);
  } else {
    // uid
    const index = logs.findIndex((log) => log.uid === event.payload.scrollTo);
    if (index >= 0) {
      list?.scrollToItem(index, 'center');
    }
  }
}

function getListHeight(containerElement: HTMLDivElement, app: CoreApp, searchVisible = false) {
  return (
    (app === CoreApp.Explore
      ? Math.max(window.innerHeight * 0.8, containerElement.clientHeight)
      : containerElement.clientHeight) - (searchVisible ? LOG_LIST_SEARCH_HEIGHT : 0)
  );
}
