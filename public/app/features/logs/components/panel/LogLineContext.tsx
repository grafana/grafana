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
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { DataQuery, TimeZone } from '@grafana/schema';
import { Button, Modal, useTheme2 } from '@grafana/ui';
import { splitOpen } from 'app/features/explore/state/main';
import { useDispatch } from 'app/types/store';

import { dataFrameToLogsModel } from '../../logsModel';
import { sortLogRows } from '../../utils';
import { ScrollDirection } from '../InfiniteScroll';
import { LoadingIndicator } from '../LoadingIndicator';

import { LogList } from './LogList';
import { ScrollToLogsEvent } from './virtualization';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css({
      width: '85vw',
      [theme.breakpoints.down('md')]: {
        width: '100%',
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
    }),
    wrapper: css({
      border: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(0, 1, 1, 0),
    }),
    logsContainer: css({
      height: '59vh',
    }),
    flexColumn: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0, 3, 3, 3),
    }),
    link: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      ':hover': {
        color: theme.colors.text.link,
      },
    }),
  };
};

interface LogLineContextProps {
  log: LogRowModel;
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
  logsSortOrder: LogsSortOrder;
  runContextQuery?: () => void;
  getLogRowContextUi?: DataSourceWithLogsContextSupport['getLogRowContextUi'];
  displayedFields: string[];
  onClickShowField?: (key: string) => void;
  onClickHideField?: (key: string) => void;
}

const PAGE_SIZE = 100;

export const LogLineContext = memo(
  ({
    log,
    logOptionsStorageKey,
    open,
    logsSortOrder,
    timeZone,
    getLogRowContextUi,
    getRowContextQuery,
    onClose,
    getRowContext,
    displayedFields,
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
    const eventBusRef = useRef(new EventBusSrv());

    const dispatch = useDispatch();
    const theme = useTheme2();
    const styles = getStyles(theme);

    const timeRange = useMemo(() => {
      const fromMs = allLogs[0].timeEpochMs;
      let toMs = allLogs[allLogs.length - 1].timeEpochMs;
      // In case we have a lot of logs and from and to have same millisecond
      // we add 1 millisecond to toMs to make sure we have a range
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
    }, [allLogs]);

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
      }
    }, [updateContextQuery, open]);

    const getContextLogs = useCallback(
      async (place: 'above' | 'below', refLog: LogRowModel): Promise<LogRowModel[]> => {
        const result = await getRowContext(normalizeLogRefId(refLog), {
          limit: PAGE_SIZE,
          direction: getLoadMoreDirection(place, logsSortOrder),
        });

        const newLogs = dataFrameToLogsModel(result.data).rows;
        if (logsSortOrder === LogsSortOrder.Ascending) {
          newLogs.reverse();
        }
        return newLogs.filter((r) => !containsRow(allLogs, r));
      },
      [allLogs, getRowContext, logsSortOrder]
    );

    const loadMore = useCallback(
      async (place: 'above' | 'below', refLog: LogRowModel) => {
        const setState = place === 'above' ? setAboveState : setBelowState;
        setState(LoadingState.Loading);

        try {
          const newLogs = (await getContextLogs(place, refLog)).map((r) =>
            // apply the original row's searchWords to all the rows for highlighting
            !r.searchWords || !r.searchWords?.length ? { ...r, searchWords: log.searchWords } : r
          );
          const [older, newer] = partition(newLogs, (newRow) => newRow.timeEpochNs > log.timeEpochNs);
          const newAbove = logsSortOrder === LogsSortOrder.Ascending ? newer : older;
          const newBelow = logsSortOrder === LogsSortOrder.Ascending ? older : newer;

          setAboveLogs((aboveLogs: LogRowModel[]) => {
            return newAbove.length > 0 ? sortLogRows([...newAbove, ...aboveLogs], logsSortOrder) : aboveLogs;
          });
          setBelowLogs((belowLogs: LogRowModel[]) => {
            return newBelow.length > 0 ? sortLogRows([...belowLogs, ...newBelow], logsSortOrder) : belowLogs;
          });
          setState(LoadingState.NotStarted);
        } catch {
          setState(LoadingState.Error);
        }
      },
      [getContextLogs, log, logsSortOrder]
    );

    useEffect(() => {
      if (!initialized) {
        Promise.all([loadMore('above', log), loadMore('below', log)]).then(() => {});
        setInitialized(true);
      }
    }, [initialized, loadMore, log]);

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

    return (
      <Modal
        isOpen={open}
        title={t('logs.log-line-context.title-log-context', 'Log context')}
        contentClassName={styles.flexColumn}
        className={styles.modal}
        onDismiss={onClose}
      >
        {config.featureToggles.logsContextDatasourceUi && getLogRowContextUi && (
          <div className={styles.datasourceUi}>{getLogRowContextUi(log, updateResults)}</div>
        )}
        <div className={styles.loadingIndicator}>
          {aboveState === LoadingState.Loading && (
            <LoadingIndicator
              adjective={
                logsSortOrder === LogsSortOrder.Descending
                  ? t('logs.log-line-context.newer-logs', 'newer')
                  : t('logs.log-line-context.older-logs', 'older')
              }
            />
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
                sortOrder={logsSortOrder}
                timeRange={timeRange}
                timeZone={timeZone}
                wrapLogMessage={
                  logOptionsStorageKey ? store.getBool(`${logOptionsStorageKey}.wrapLogMessage`, true) : true
                }
              />
            )}
          </div>
        </div>
        <div className={styles.loadingIndicator}>
          {belowState === LoadingState.Loading && (
            <LoadingIndicator
              adjective={
                logsSortOrder === LogsSortOrder.Descending
                  ? t('logs.log-line-context.older-logs', 'older')
                  : t('logs.log-line-context.newer-logs', 'newer')
              }
            />
          )}
        </div>

        <Modal.ButtonRow>
          <Button variant="secondary" onClick={onScrollCenterClick}>
            <Trans i18nKey="logs.log-line-context.center-matched-line">Center matched line</Trans>
          </Button>
          {contextQuery?.datasource?.uid && (
            <Button
              variant="secondary"
              onClick={async () => {
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
              }}
            >
              <Trans i18nKey="logs.log-line-context.open-in-split-view">Open in split view</Trans>
            </Button>
          )}
        </Modal.ButtonRow>
      </Modal>
    );
  }
);
LogLineContext.displayName = 'LogLineContext';

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
