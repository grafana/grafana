import { css } from '@emotion/css';
import { partition } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DataQueryResponse,
  DataSourceWithLogsContextSupport,
  GrafanaTheme2,
  LogRowContextOptions,
  LogRowContextQueryDirection,
  LogsDedupStrategy,
  LogsSortOrder,
  dateTime,
  TimeRange,
  LoadingState,
  CoreApp,
  LogRowModel,
  AbsoluteTimeRange,
  EventBusSrv,
  store,
  getValueFormat,
  formattedValueToString,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Button, Collapse, Combobox, ComboboxOption, InlineLabel, Modal, Stack, useTheme2 } from '@grafana/ui';
import { splitOpen } from 'app/features/explore/state/main';
import { useDispatch } from 'app/types/store';

import { dataFrameToLogsModel } from '../../logsModel';
import { sortLogRows } from '../../utils';
import { ScrollDirection } from '../InfiniteScroll';
import { LoadingIndicator } from '../LoadingIndicator';

import { LogLineDetailsLog } from './LogLineDetailsLog';
import { LogList } from './LogList';
import { LogListModel } from './processing';
import { ScrollToLogsEvent } from './virtualization';

interface LogLineContextProps {
  log: LogRowModel | LogListModel;
  logOptionsStorageKey?: string;
  open: boolean;
  timeZone: TimeZone;
  onClose: () => void;
  getRowContext: (row: LogRowModel, options: LogRowContextOptions) => Promise<DataQueryResponse>;
  getRowContextQuery?: (
    row: LogRowModel,
    options?: LogRowContextOptions,
    cacheFilters?: boolean
  ) => Promise<DataQuery | null>;
  sortOrder?: LogsSortOrder;
  runContextQuery?: () => void;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
  displayedFields?: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
}

const PAGE_SIZE = 100;

export const LogLineContext = memo(
  ({
    log,
    logOptionsStorageKey,
    open,
    sortOrder = logOptionsStorageKey
      ? (store.get(`${logOptionsStorageKey}.sortOrder`) ?? LogsSortOrder.Descending)
      : LogsSortOrder.Descending,
    timeZone,
    getLogRowContextUi,
    getRowContextQuery,
    onClose,
    getRowContext,
    displayedFields = [],
    onClickShowField,
    onClickHideField,
  }: LogLineContextProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [contextQuery, setContextQuery] = useState<DataQuery | null>(null);
    const [aboveLogs, setAboveLogs] = useState<LogRowModel[]>([]);
    const [belowLogs, setBelowLogs] = useState<LogRowModel[]>([]);
    const [initialized, setInitialized] = useState(false);
    const allLogs = useMemo(() => [...aboveLogs, log, ...belowLogs], [log, belowLogs, aboveLogs]);
    const [aboveState, setAboveState] = useState(LoadingState.NotStarted);
    const [belowState, setBelowState] = useState(LoadingState.NotStarted);
    const [showLog, setShowLog] = useState(false);
    const defaultTimeWindow = logOptionsStorageKey
      ? (store.get(`${logOptionsStorageKey}.contextTimeWindow`) ?? '7200000')
      : '7200000';
    const [timeWindow, setTimeWindow] = useState(parseInt(defaultTimeWindow, 10));

    const eventBusRef = useRef(new EventBusSrv());

    const dispatch = useDispatch();
    const theme = useTheme2();
    const styles = getStyles(theme);

    const timeRange = useMemo(() => {
      const fromMs =
        sortOrder === LogsSortOrder.Ascending ? allLogs[0].timeEpochMs : allLogs[allLogs.length - 1].timeEpochMs;
      let toMs =
        sortOrder === LogsSortOrder.Ascending ? allLogs[allLogs.length - 1].timeEpochMs : allLogs[0].timeEpochMs;
      // Add one second to get a range when from and to are equal.
      if (fromMs === toMs) {
        toMs += 1;
      }
      const from = dateTime(fromMs);
      const to = dateTime(toMs);

      const range: TimeRange = {
        from,
        to,
        raw: {
          from,
          to,
        },
      };
      return range;
    }, [allLogs, sortOrder]);

    const updateContextQuery = useCallback(async () => {
      const contextQuery = getRowContextQuery ? await getRowContextQuery(log) : null;
      setContextQuery(contextQuery);
    }, [log, getRowContextQuery]);

    const updateResults = useCallback(async () => {
      setAboveLogs([]);
      setBelowLogs([]);
      await updateContextQuery();
      setInitialized(false);
    }, [updateContextQuery]);

    useEffect(() => {
      if (open) {
        updateContextQuery();
        reportInteraction('logs_log_line_context_open', {
          datasourceType: log.datasourceType,
          uid: log.uid,
        });
      }
    }, [updateContextQuery, open, log]);

    const getContextLogs = useCallback(
      async (place: 'above' | 'below', refLog: LogRowModel, timeWindowMs?: number): Promise<LogRowModel[]> => {
        const result = await getRowContext(normalizeLogRefId(refLog), {
          limit: PAGE_SIZE,
          direction: getLoadMoreDirection(place, sortOrder),
          // Only on the initial request
          timeWindowMs,
        });

        const newLogs = dataFrameToLogsModel(result.data).rows;
        if (sortOrder === LogsSortOrder.Ascending) {
          newLogs.reverse();
        }
        return newLogs.filter((r) => !containsRow(allLogs, r));
      },
      [allLogs, getRowContext, sortOrder]
    );

    const loadMore = useCallback(
      async (place: 'above' | 'below', refLog: LogRowModel, timeWindow?: number) => {
        const setState = place === 'above' ? setAboveState : setBelowState;
        setState(LoadingState.Loading);

        try {
          const newLogs = (await getContextLogs(place, refLog, timeWindow)).map((r) =>
            // apply the original row's searchWords to all the rows for highlighting
            !r.searchWords || !r.searchWords?.length ? { ...r, searchWords: log.searchWords } : r
          );
          const [older, newer] = partition(newLogs, (newRow) => newRow.timeEpochNs > log.timeEpochNs);
          const newAbove = sortOrder === LogsSortOrder.Ascending ? newer : older;
          const newBelow = sortOrder === LogsSortOrder.Ascending ? older : newer;

          setAboveLogs((aboveLogs: LogRowModel[]) => {
            return newAbove.length > 0 ? sortLogRows([...newAbove, ...aboveLogs], sortOrder) : aboveLogs;
          });
          setBelowLogs((belowLogs: LogRowModel[]) => {
            return newBelow.length > 0 ? sortLogRows([...belowLogs, ...newBelow], sortOrder) : belowLogs;
          });

          setState(LoadingState.NotStarted);
          if (!newAbove.length && place === 'above') {
            setAboveState(LoadingState.Done);
          }
          if (!newBelow.length && place === 'below') {
            setBelowState(LoadingState.Done);
          }
        } catch {
          setState(LoadingState.Error);
        }
      },
      [getContextLogs, log, sortOrder]
    );

    useEffect(() => {
      if (!open) {
        return;
      }
      if (!initialized) {
        Promise.all([loadMore('above', log, timeWindow), loadMore('below', log, timeWindow)]);
        setInitialized(true);
      }
    }, [initialized, loadMore, log, open, timeWindow]);

    const handleLoadMore = useCallback(
      (_: AbsoluteTimeRange, direction: ScrollDirection) => {
        if (direction === ScrollDirection.Bottom) {
          loadMore('below', allLogs[allLogs.length - 1]);
        } else {
          loadMore('above', allLogs[0]);
        }
      },
      [allLogs, loadMore]
    );

    const onScrollCenterClick = useCallback(() => {
      eventBusRef.current.publish(
        new ScrollToLogsEvent({
          scrollTo: log.uid,
        })
      );
    }, [log.uid]);

    const onSplitViewClick = useCallback(() => {
      if (!contextQuery) {
        return;
      }
      let rowId = log.uid;
      if (log.dataFrame.refId) {
        // the orignal row has the refid from the base query and not the refid from the context query, so we need to replace it.
        rowId = log.uid.replace(log.dataFrame.refId, contextQuery.refId);
      }

      dispatch(
        splitOpen({
          queries: [contextQuery],
          range: timeRange,
          datasourceUid: contextQuery.datasource!.uid!,
          panelsState: {
            logs: {
              id: rowId,
            },
          },
        })
      );
      onClose();
      reportInteraction('logs_log_line_context_open_in_split_clicked', {
        datasourceType: log.datasourceType,
      });
    }, [contextQuery, dispatch, log.dataFrame.refId, log.datasourceType, log.uid, onClose, timeRange]);

    const handleTimeWindowChange = useCallback(
      (option: ComboboxOption<string>) => {
        if (logOptionsStorageKey) {
          store.set(`${logOptionsStorageKey}.contextTimeWindow`, option.value);
        }
        setTimeWindow(parseInt(option.value, 10));
        setAboveLogs([]);
        setBelowLogs([]);
        setInitialized(false);
        reportInteraction('logs_log_line_context_time_window_change', {
          window_size: option.value,
        });
      },
      [logOptionsStorageKey]
    );

    const handleClose = useCallback(() => {
      reportInteraction('logs_log_line_context_closed', {
        datasourceType: log.datasourceType,
        uid: log.uid,
      });
      onClose();
    }, [log.datasourceType, log.uid, onClose]);

    const wrapLogMessage = logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.wrapLogMessage`, true) : true;
    const syntaxHighlighting = logOptionsStorageKey
      ? store.getBool(`${logOptionsStorageKey}.syntaxHighlighting`, true)
      : true;

    // @todo: Remove when the LogRows are deprecated
    const logListModel = useMemo(
      () =>
        log instanceof LogListModel
          ? log
          : new LogListModel(log, {
              escape: false,
              timeZone,
              wrapLogMessage,
            }),
      [log, timeZone, wrapLogMessage]
    );

    return (
      <Modal
        isOpen={open}
        title={t('logs.log-line-context.title-log-context', 'Log context')}
        contentClassName={styles.flexColumn}
        className={styles.modal}
        onDismiss={handleClose}
      >
        {config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (
          <div className={styles.datasourceUi}>{getLogRowContextUi(log, updateResults)}</div>
        )}
        <Collapse
          collapsible={true}
          isOpen={showLog}
          onToggle={() => setShowLog(!showLog)}
          className={styles.referenceLogLine}
          label={t('logs.log-line-context.title-log-line', 'Referenced log line')}
        >
          <LogLineDetailsLog log={logListModel} syntaxHighlighting={syntaxHighlighting} />
        </Collapse>
        <div className={styles.controls}>
          {log.datasourceType === 'loki' && (
            <Stack>
              <InlineLabel
                htmlFor="time-window-control"
                tooltip={t(
                  'logs.log-line-context.time-window-tooltip',
                  'Amount of time before and after the referenced log'
                )}
                width="auto"
              >
                {t('logs.log-line-context.time-window-label', 'Context time window')}
              </InlineLabel>
              <Combobox
                id="time-window-control"
                options={getTimeWindowOptions()}
                onChange={handleTimeWindowChange}
                value={timeWindow.toString()}
                minWidth={5}
                width="auto"
              />
            </Stack>
          )}
          <Button variant="secondary" onClick={onScrollCenterClick}>
            <Trans i18nKey="logs.log-line-context.center-matched-line">Center matched line</Trans>
          </Button>
          {contextQuery?.datasource?.uid && (
            <Button variant="secondary" onClick={onSplitViewClick}>
              <Trans i18nKey="logs.log-line-context.open-in-split-view">Open in split view</Trans>
            </Button>
          )}
        </div>
        <div className={styles.loadingIndicator}>
          {aboveState === LoadingState.Loading && (
            <LoadingIndicator
              adjective={
                sortOrder === LogsSortOrder.Descending
                  ? t('logs.log-line-context.newer-logs', 'newer')
                  : t('logs.log-line-context.older-logs', 'older')
              }
            />
          )}
          {aboveState === LoadingState.Done && (
            <Trans i18nKey="logs.log-line-context.no-more-logs-available">No more logs available.</Trans>
          )}
        </div>
        <div className={styles.wrapper}>
          <div className={styles.logsContainer} ref={containerRef}>
            {containerRef.current && (
              <LogList
                app={CoreApp.Unknown}
                containerElement={containerRef.current}
                dedupStrategy={LogsDedupStrategy.none}
                detailsMode="inline"
                displayedFields={displayedFields}
                enableLogDetails={true}
                eventBus={eventBusRef.current}
                infiniteScrollMode="unlimited"
                loadMore={handleLoadMore}
                logs={allLogs}
                loading={aboveState === LoadingState.Loading || belowState === LoadingState.Loading}
                permalinkedLogId={log.uid}
                onClickHideField={onClickHideField}
                onClickShowField={onClickShowField}
                showControls
                showTime={logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.showTime`, true) : true}
                sortOrder={sortOrder}
                syntaxHighlighting={syntaxHighlighting}
                timeRange={timeRange}
                timeZone={timeZone}
                wrapLogMessage={wrapLogMessage}
              />
            )}
          </div>
        </div>
        <div className={styles.loadingIndicator}>
          {belowState === LoadingState.Loading && (
            <LoadingIndicator
              adjective={
                sortOrder === LogsSortOrder.Descending
                  ? t('logs.log-line-context.older-logs', 'older')
                  : t('logs.log-line-context.newer-logs', 'newer')
              }
            />
          )}
          {belowState === LoadingState.Done && (
            <Trans i18nKey="logs.log-line-context.no-more-logs-available">No more logs available.</Trans>
          )}
        </div>
      </Modal>
    );
  }
);
LogLineContext.displayName = 'LogLineContext';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css({
      width: '85vw',
      height: '80%',
      [theme.breakpoints.down('md')]: {
        width: '100%',
        minHeight: '100%',
      },
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }),
    datasourceUi: css({
      display: 'flex',
      alignItems: 'center',
    }),
    loadingIndicator: css({
      height: theme.spacing(3),
      minHeight: theme.spacing(3),
      textAlign: 'center',
    }),
    referenceLogLine: css({
      flex: 0,
    }),
    wrapper: css({
      border: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(0, 1, 1, 0),
      flex: 1,
      height: '100%',
    }),
    logsContainer: css({
      height: '100%',
      overflow: 'hidden',
    }),
    flexColumn: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 3, 3, 3),
      height: '100%',
      gap: theme.spacing(0.5),
    }),
    link: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      ':hover': {
        color: theme.colors.text.link,
      },
    }),
    logPreview: css({
      overflow: 'hidden',
      textAlign: 'left',
      textOverflow: 'ellipsis',
      width: '75vw',
      whiteSpace: 'nowrap',
    }),
    controls: css({
      display: 'flex',
      justifyContent: 'flex-end',
      gap: theme.spacing(2),
    }),
  };
};

const getLoadMoreDirection = (place: 'above' | 'below', sortOrder: LogsSortOrder): LogRowContextQueryDirection => {
  if (place === 'above' && sortOrder === LogsSortOrder.Descending) {
    return LogRowContextQueryDirection.Forward;
  }
  if (place === 'below' && sortOrder === LogsSortOrder.Ascending) {
    return LogRowContextQueryDirection.Forward;
  }

  return LogRowContextQueryDirection.Backward;
};

const normalizeLogRefId = (log: LogRowModel): LogRowModel => {
  // the datasoure plugins often create the context-query based on the row's dataframe's refId,
  // by appending something to it. for example:
  // - let's say the row's dataframe's refId is "query"
  // - the datasource plugin will take "query" and append "-context" to it, so it becomes "query-context".
  // - later we want to load even more lines, so we make a context query
  // - the datasource plugin does the same transform again, but now the source is "query-context",
  //   so the new refId becomes "query-context-context"
  // - next time it becomes "query-context-context-context", and so on.
  // we do not want refIds to grow unbounded.
  // to avoid this, we set the refId to a value that does not grow.
  // on the other hand, the refId is also used in generating the row's UID, so it is useful
  // when the refId is not always the exact same string, otherwise UID duplication can occur,
  // which may cause problems.
  // so we go with an approach where the refId always changes, but does not grow.
  return {
    ...log,
    dataFrame: {
      ...log.dataFrame,
      refId: `context_${log.uid ?? log.dataFrame.refId ?? log.timeEpochMs}`,
    },
  };
};

const containsRow = (rows: LogRowModel[], row: LogRowModel) => {
  return rows.some((r) => r.entry === row.entry && r.timeEpochNs === row.timeEpochNs);
};

function getTimeWindowOptions() {
  const intervals = [100, 500, 1000, 5000, 30000, 60000, 300000, 1800000, 3600000, 7200000];
  return intervals.map((interval) => ({
    label: formattedValueToString(getValueFormat('ms')(interval)),
    value: interval.toString(),
  }));
}
