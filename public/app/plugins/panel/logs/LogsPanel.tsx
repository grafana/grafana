import { css, cx } from '@emotion/css';
import { groupBy } from 'lodash';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isObservable, lastValueFrom } from 'rxjs';

import {
  AbsoluteTimeRange,
  CoreApp,
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  DataQueryResponse,
  DataSourceApi,
  dateTimeForTimeZone,
  Field,
  GrafanaTheme2,
  hasLogsContextSupport,
  hasLogsContextUiSupport,
  Labels,
  LogRowContextOptions,
  LogRowModel,
  LogsSortOrder,
  PanelData,
  PanelProps,
  TimeRange,
  TimeZone,
  toUtc,
  urlUtil,
} from '@grafana/data';
import { convertRawToRange } from '@grafana/data/src/datetime/rangeutil';
import { combineResponses } from '@grafana/o11y-ds-frontend';
import { config } from '@grafana/runtime';
import { CustomScrollbar, usePanelContext, useStyles2 } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { InfiniteScroll } from 'app/features/logs/components/InfiniteScroll';
import { LogRowContextModal } from 'app/features/logs/components/log-context/LogRowContextModal';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';
import { SupportingQueryType } from 'app/plugins/datasource/loki/types';

import { createAndCopyShortLink, getPermalinkRange } from '../../../core/utils/shortLinks';
import { LogLabels } from '../../../features/logs/components/LogLabels';
import { LogRows } from '../../../features/logs/components/LogRows';
import {
  COMMON_LABELS,
  dataFrameToLogsModel,
  dedupLogRows,
  infiniteScrollRefId,
} from '../../../features/logs/logsModel';

import { Options } from './types';
import { useDatasourcesFromTargets } from './useDatasourcesFromTargets';

interface LogsPanelProps extends PanelProps<Options> {}
interface LogsPermalinkUrlState {
  logs?: {
    id?: string;
  };
}

export const LogsPanel = ({
  data,
  timeZone,
  fieldConfig,
  options: {
    showLabels,
    showTime,
    wrapLogMessage,
    showCommonLabels,
    prettifyLogMessage,
    sortOrder,
    dedupStrategy,
    enableLogDetails,
    showLogContextToggle,
  },
  id,
}: LogsPanelProps) => {
  const isAscending = sortOrder === LogsSortOrder.Ascending;
  const style = useStyles2(getStyles);
  const [scrollTop, setScrollTop] = useState(0);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [contextRow, setContextRow] = useState<LogRowModel | null>(null);
  const closeCallback = useRef<() => void>();
  const dataSourcesMap = useDatasourcesFromTargets(data.request?.targets);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | undefined>(undefined);
  // Loading state to be passed as a prop to the <InfiniteScroll> component
  const [infiniteScrolling, setInfiniteScrolling] = useState(false);
  // Loading ref to prevent firing multiple requests
  const loadingRef = useRef(false);
  const [panelData, setPanelData] = useState(data);

  const { eventBus } = usePanelContext();
  const onLogRowHover = useCallback(
    (row?: LogRowModel) => {
      if (!row) {
        eventBus.publish(new DataHoverClearEvent());
      } else {
        eventBus.publish(
          new DataHoverEvent({
            point: {
              time: row.timeEpochMs,
            },
          })
        );
      }
    },
    [eventBus]
  );

  const onCloseContext = useCallback(() => {
    setContextRow(null);
    if (closeCallback.current) {
      closeCallback.current();
    }
  }, [closeCallback]);

  const onOpenContext = useCallback(
    (row: LogRowModel, onClose: () => void) => {
      setContextRow(row);
      closeCallback.current = onClose;
    },
    [closeCallback]
  );

  const showContextToggle = useCallback(
    (row: LogRowModel): boolean => {
      if (
        !row.dataFrame.refId ||
        !dataSourcesMap ||
        (!showLogContextToggle &&
          data.request?.app !== CoreApp.Dashboard &&
          data.request?.app !== CoreApp.PanelEditor &&
          data.request?.app !== CoreApp.PanelViewer)
      ) {
        return false;
      }

      const dataSource = dataSourcesMap.get(row.dataFrame.refId);
      return hasLogsContextSupport(dataSource);
    },
    [dataSourcesMap, showLogContextToggle, data.request?.app]
  );

  const showPermaLink = useCallback(() => {
    return !(
      data.request?.app !== CoreApp.Dashboard &&
      data.request?.app !== CoreApp.PanelEditor &&
      data.request?.app !== CoreApp.PanelViewer
    );
  }, [data.request?.app]);

  const getLogRowContext = useCallback(
    async (row: LogRowModel, origRow: LogRowModel, options: LogRowContextOptions): Promise<DataQueryResponse> => {
      if (!origRow.dataFrame.refId || !dataSourcesMap) {
        return Promise.resolve({ data: [] });
      }

      const query = data.request?.targets[0];
      if (!query) {
        return Promise.resolve({ data: [] });
      }

      const dataSource = dataSourcesMap.get(origRow.dataFrame.refId);
      if (!hasLogsContextSupport(dataSource)) {
        return Promise.resolve({ data: [] });
      }

      return dataSource.getLogRowContext(row, options, query);
    },
    [data.request?.targets, dataSourcesMap]
  );

  const getLogRowContextUi = useCallback(
    (origRow: LogRowModel, runContextQuery?: () => void): React.ReactNode => {
      if (!origRow.dataFrame.refId || !dataSourcesMap) {
        return <></>;
      }

      const query = data.request?.targets[0];
      if (!query) {
        return <></>;
      }

      const dataSource = dataSourcesMap.get(origRow.dataFrame.refId);
      if (!hasLogsContextUiSupport(dataSource)) {
        return <></>;
      }

      if (!dataSource.getLogRowContextUi) {
        return <></>;
      }

      return dataSource.getLogRowContextUi(origRow, runContextQuery, query);
    },
    [data.request?.targets, dataSourcesMap]
  );

  // Important to memoize stuff here, as panel rerenders a lot for example when resizing.
  const [logRows, deduplicatedRows, commonLabels] = useMemo(() => {
    const logs = panelData
      ? dataFrameToLogsModel(
          panelData.series,
          data.request?.intervalMs,
          undefined,
          data.request?.targets.map((query) => ({
            ...query,
            // Needed to trigger de-duplication. Will be stripped by dataFrameToLogsModel()
            refId: `${infiniteScrollRefId}${query.refId}`,
          }))
        )
      : null;
    const logRows = logs?.rows || [];
    const commonLabels = logs?.meta?.find((m) => m.label === COMMON_LABELS);
    const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
    return [logRows, deduplicatedRows, commonLabels];
  }, [data.request?.intervalMs, data.request?.targets, dedupStrategy, panelData]);

  const onPermalinkClick = useCallback(
    async (row: LogRowModel) => {
      return await copyDashboardUrl(row, logRows, data.timeRange);
    },
    [data.timeRange, logRows]
  );

  useEffect(() => {
    setPanelData(data);
  }, [data]);

  useLayoutEffect(() => {
    if (isAscending && logsContainerRef.current) {
      setScrollTop(logsContainerRef.current.offsetHeight);
    } else {
      setScrollTop(0);
    }
  }, [isAscending, logRows]);

  const getFieldLinks = useCallback(
    (field: Field, rowIndex: number) => {
      return getFieldLinksForExplore({ field, rowIndex, range: data.timeRange });
    },
    [data]
  );

  /**
   * Scrolls the given row into view.
   */
  const scrollIntoView = useCallback(
    (row: HTMLElement) => {
      scrollElement?.scrollTo({
        top: row.offsetTop,
        behavior: 'smooth',
      });
    },
    [scrollElement]
  );

  const loadMoreLogs = useCallback(
    async (scrollRange: AbsoluteTimeRange) => {
      if (!data.request || !config.featureToggles.logsInfiniteScrolling || loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      setInfiniteScrolling(true);

      let newSeries: DataFrame[] = [];
      try {
        newSeries = await requestMoreLogs(dataSourcesMap, panelData, scrollRange, timeZone);
      } catch (e) {
        console.error(e);
      } finally {
        setInfiniteScrolling(false);
        loadingRef.current = false;
      }

      setPanelData({
        ...panelData,
        series: newSeries,
      });
    },
    [data.request, dataSourcesMap, panelData, timeZone]
  );

  if (!data || logRows.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  const renderCommonLabels = () => (
    <div className={cx(style.labelContainer, isAscending && style.labelContainerAscending)}>
      <span className={style.label}>Common labels:</span>
      <LogLabels labels={commonLabels ? (commonLabels.value as Labels) : { labels: '(no common labels)' }} />
    </div>
  );

  return (
    <>
      {contextRow && (
        <LogRowContextModal
          open={contextRow !== null}
          row={contextRow}
          onClose={onCloseContext}
          getRowContext={(row, options) => getLogRowContext(row, contextRow, options)}
          logsSortOrder={sortOrder}
          timeZone={timeZone}
          getLogRowContextUi={getLogRowContextUi}
        />
      )}
      <CustomScrollbar
        autoHide
        scrollTop={scrollTop}
        scrollRefCallback={(element) => setScrollElement(element || undefined)}
      >
        <div className={style.container} ref={logsContainerRef}>
          {showCommonLabels && !isAscending && renderCommonLabels()}
          <InfiniteScroll
            loading={infiniteScrolling}
            loadMoreLogs={loadMoreLogs}
            range={data.timeRange}
            timeZone={timeZone}
            rows={logRows}
            scrollElement={scrollElement}
            sortOrder={sortOrder}
          >
            <LogRows
              containerRendered={logsContainerRef.current !== null}
              scrollIntoView={scrollIntoView}
              permalinkedRowId={getLogsPanelState()?.logs?.id ?? undefined}
              onPermalinkClick={showPermaLink() ? onPermalinkClick : undefined}
              logRows={logRows}
              showContextToggle={showContextToggle}
              deduplicatedRows={deduplicatedRows}
              dedupStrategy={dedupStrategy}
              showLabels={showLabels}
              showTime={showTime}
              wrapLogMessage={wrapLogMessage}
              prettifyLogMessage={prettifyLogMessage}
              timeZone={timeZone}
              getFieldLinks={getFieldLinks}
              logsSortOrder={sortOrder}
              enableLogDetails={enableLogDetails}
              previewLimit={isAscending ? logRows.length : undefined}
              onLogRowHover={onLogRowHover}
              app={CoreApp.Dashboard}
              onOpenContext={onOpenContext}
            />
          </InfiniteScroll>
          {showCommonLabels && isAscending && renderCommonLabels()}
        </div>
      </CustomScrollbar>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(1.5),
  }),
  labelContainer: css({
    margin: theme.spacing(0, 0, 0.5, 0.5),
    display: 'flex',
    alignItems: 'center',
  }),
  labelContainerAscending: css({
    margin: theme.spacing(0.5, 0, 0.5, 0),
  }),
  label: css({
    marginRight: theme.spacing(0.5),
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});

function getLogsPanelState(): LogsPermalinkUrlState | undefined {
  const urlParams = urlUtil.getUrlSearchParams();
  const panelStateEncoded = urlParams?.panelState;
  if (
    panelStateEncoded &&
    Array.isArray(panelStateEncoded) &&
    panelStateEncoded?.length > 0 &&
    typeof panelStateEncoded[0] === 'string'
  ) {
    try {
      return JSON.parse(panelStateEncoded[0]);
    } catch (e) {
      console.error('error parsing logsPanelState', e);
    }
  }

  return undefined;
}

async function copyDashboardUrl(row: LogRowModel, rows: LogRowModel[], timeRange: TimeRange) {
  // this is an extra check, to be sure that we are not
  // creating permalinks for logs without an id-field.
  // normally it should never happen, because we do not
  // display the permalink button in such cases.
  if (row.rowId === undefined || !row.dataFrame.refId) {
    return;
  }

  // get panel state, add log-row-id
  const panelState = {
    logs: { id: row.uid },
  };

  // Grab the current dashboard URL
  const currentURL = new URL(window.location.href);

  // Add panel state containing the rowId, and absolute time range from the current query, but leave everything else the same, if the user is in edit mode when grabbing the link, that's what will be linked to, etc.
  currentURL.searchParams.set('panelState', JSON.stringify(panelState));
  const range = getPermalinkRange(row, rows, {
    from: toUtc(timeRange.from).valueOf(),
    to: toUtc(timeRange.to).valueOf(),
  });
  currentURL.searchParams.set('from', range.from.toString(10));
  currentURL.searchParams.set('to', range.to.toString(10));

  await createAndCopyShortLink(currentURL.toString());

  return Promise.resolve();
}

async function requestMoreLogs(
  dataSourcesMap: Map<string, DataSourceApi>,
  panelData: PanelData,
  timeRange: AbsoluteTimeRange,
  timeZone: TimeZone
) {
  if (!panelData.request) {
    return [];
  }

  const range: TimeRange = convertRawToRange({
    from: dateTimeForTimeZone(timeZone, timeRange.from),
    to: dateTimeForTimeZone(timeZone, timeRange.to),
  });

  const targetGroups = groupBy(panelData.request.targets, 'datasource.uid');
  const dataRequests = [];

  for (const uid in targetGroups) {
    const dataSource = dataSourcesMap.get(panelData.request.targets[0].refId);
    if (!dataSource) {
      console.log('no ds');
      continue;
    }
    dataRequests.push(
      dataSource.query({
        ...panelData.request,
        range,
        targets: targetGroups[uid].map((query) => ({
          ...query,
          supportingQueryType: SupportingQueryType.InfiniteScroll,
        })),
      })
    );
  }

  const responses = await Promise.all(dataRequests);
  let newSeries = panelData.series;
  for (const response of responses) {
    const newData = isObservable(response) ? await lastValueFrom(response) : response;
    newSeries = combineResponses(
      {
        data: newSeries,
      },
      { data: newData.data }
    ).data;
  }

  return newSeries;
}
