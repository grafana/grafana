import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { Grammar } from 'prismjs';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, MouseEvent } from 'react';
import { VariableSizeList } from 'react-window';

import {
  AbsoluteTimeRange,
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
import { Trans, useTranslate } from '@grafana/i18n';
import { ConfirmModal, Icon, PopoverContent, useTheme2 } from '@grafana/ui';
import { PopoverMenu } from 'app/features/explore/Logs/PopoverMenu';
import { GetFieldLinksFn } from 'app/plugins/panel/logs/types';

import { InfiniteScroll } from './InfiniteScroll';
import { getGridTemplateColumns } from './LogLine';
import { LogLineDetails } from './LogLineDetails';
import { GetRowContextQueryFn, LogLineMenuCustomItem } from './LogLineMenu';
import { LogListContextProvider, LogListState, useLogListContext } from './LogListContext';
import { LogListControls } from './LogListControls';
import { preProcessLogs, LogListModel } from './processing';
import { usePopoverMenu } from './usePopoverMenu';
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
  fontSize?: LogListFontSize;
  getFieldLinks?: GetFieldLinksFn;
  getRowContextQuery?: GetRowContextQueryFn;
  grammar?: Grammar;
  initialScrollPosition?: 'top' | 'bottom';
  isLabelFilterActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
  loading?: boolean;
  loadMore?: (range: AbsoluteTimeRange) => void;
  logLineMenuCustomItems?: LogLineMenuCustomItem[];
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
  permalinkedLogId?: string;
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

export type LogListFontSize = 'default' | 'small';

export type LogListControlOptions = LogListState;

type LogListComponentProps = Omit<
  Props,
  | 'app'
  | 'dedupStrategy'
  | 'displayedFields'
  | 'enableLogDetails'
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
  dedupStrategy,
  enableLogDetails,
  eventBus,
  filterLevels,
  logOptionsStorageKey,
  fontSize = logOptionsStorageKey ? (store.get(`${logOptionsStorageKey}.fontSize`) ?? 'default') : 'default',
  getFieldLinks,
  getRowContextQuery,
  grammar,
  initialScrollPosition = 'top',
  isLabelFilterActive,
  loading,
  loadMore,
  logLineMenuCustomItems,
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
  permalinkedLogId,
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
      fontSize={fontSize}
      getRowContextQuery={getRowContextQuery}
      isLabelFilterActive={isLabelFilterActive}
      logs={logs}
      logsMeta={logsMeta}
      logLineMenuCustomItems={logLineMenuCustomItems}
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
      permalinkedLogId={permalinkedLogId}
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
    toggleDetails,
    wrapLogMessage,
  } = useLogListContext();
  const [processedLogs, setProcessedLogs] = useState<LogListModel[]>([]);
  const [listHeight, setListHeight] = useState(
    app === CoreApp.Explore
      ? Math.max(window.innerHeight * 0.8, containerElement.clientHeight)
      : containerElement.clientHeight
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
  const styles = getStyles(dimensions, { showTime }, theme);
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
  const { t } = useTranslate();

  const debouncedResetAfterIndex = useMemo(() => {
    return debounce((index: number) => {
      listRef.current?.resetAfterIndex(index);
      overflowIndexRef.current = Infinity;
    }, 25);
  }, []);

  useEffect(() => {
    initVirtualization(theme, fontSize);
  }, [fontSize, theme]);

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
  }, [wrapLogMessage, showDetails, displayedFields, dedupStrategy]);

  useEffect(() => {
    const handleResize = debounce(() => {
      setListHeight(
        app === CoreApp.Explore
          ? Math.max(window.innerHeight * 0.8, containerElement.clientHeight)
          : containerElement.clientHeight
      );
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
        storeLogLineSize(id, widthContainer, height, fontSize);
      }
      if (index === overflowIndexRef.current) {
        return;
      }
      overflowIndexRef.current = index < overflowIndexRef.current ? index : overflowIndexRef.current;
      debouncedResetAfterIndex(overflowIndexRef.current);
    },
    [debouncedResetAfterIndex, fontSize, widthContainer]
  );

  const handleScrollPosition = useCallback(() => {
    if (permalinkedLogId) {
      const index = processedLogs.findIndex((log) => log.uid === permalinkedLogId);
      if (index >= 0) {
        listRef.current?.scrollToItem(index, 'start');
        return;
      }
    }
    listRef.current?.scrollToItem(initialScrollPosition === 'top' ? 0 : processedLogs.length - 1);
  }, [initialScrollPosition, permalinkedLogId, processedLogs]);

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

  const filteredLogs = useMemo(
    () =>
      filterLevels.length === 0 ? processedLogs : processedLogs.filter((log) => filterLevels.includes(log.logLevel)),
    [filterLevels, processedLogs]
  );

  return (
    <div className={styles.logListContainer}>
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
                fontSize,
                hasLogsWithErrors,
                hasSampledLogs,
                showDuplicates: dedupStrategy !== LogsDedupStrategy.none,
                showTime,
                wrap: wrapLogMessage,
              })}
              itemKey={getItemKey}
              layout="vertical"
              onItemsRendered={onItemsRendered}
              outerRef={scrollRef}
              overscanCount={5}
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

function getStyles(dimensions: LogFieldDimension[], { showTime }: { showTime: boolean }, theme: GrafanaTheme2) {
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
      // Minimum width to prevent rendering issues and a sausage-like logs panel.
      minWidth: theme.spacing(35),
    }),
    logListWrapper: css({
      width: '100%',
      position: 'relative',
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

function handleScrollToEvent(event: ScrollToLogsEvent, logsCount: number, list: VariableSizeList | null) {
  if (event.payload.scrollTo === 'top') {
    list?.scrollTo(0);
  } else {
    list?.scrollToItem(logsCount - 1);
  }
}
