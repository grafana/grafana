import { css } from '@emotion/css';
import { groupBy } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';
import { isObservable, lastValueFrom } from 'rxjs';

import {
  type AbsoluteTimeRange,
  CoreApp,
  type DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  type DataQueryResponse,
  type DataSourceApi,
  dateTimeForTimeZone,
  type GrafanaTheme2,
  hasLogsContextSupport,
  hasLogsContextUiSupport,
  type LogRowContextOptions,
  type LogRowModel,
  LogsSortOrder,
  type PanelData,
  type PanelProps,
  type TimeRange,
  type TimeZone,
  toUtc,
  LogSortOrderChangeEvent,
  LoadingState,
  rangeUtil,
  transformDataFrame,
  store,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { LogLineContext } from 'app/features/logs/components/panel/LogLineContext';
import { LogList } from 'app/features/logs/components/panel/LogList';
import { getLogsPanelState } from 'app/features/logs/components/panel/panelState/getLogsPanelState';
import { isMissingStringField, isMissingTimeField } from 'app/features/logs/utils';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';
import { combineResponses } from 'app/plugins/datasource/loki/mergeResponses';

import { createAndCopyShortLink, getLogsPermalinkRange } from '../../../core/utils/shortLinks';
import { dataFrameToLogsModel, dedupLogRows } from '../../../features/logs/logsModel';

import type { Options } from './panelcfg.gen';
import {
  type GetFieldLinksFn,
  isCoreApp,
  isGrammar,
  isIsFilterLabelActive,
  isLogLineMenuCustomItems,
  isOnClickFilterLabel,
  isOnClickFilterOutLabel,
  isOnClickFilterOutString,
  isOnClickFilterString,
  isOnClickHideField,
  isOnClickShowField,
  isOnLogOptionsChange,
  isOnNewLogsReceivedType,
  isSetDisplayedFields,
  type onNewLogsReceivedType,
} from './types';
import { useDatasourcesFromTargets } from './useDatasourcesFromTargets';

interface LogsPanelProps extends PanelProps<Options> {
  /**
   * Adds a key => value filter to the query referenced by the provided DataFrame refId. Used by Log details and Logs table.
   * onClickFilterLabel?: (key: string, value: string, frame?: DataFrame) => void;
   *
   * Adds a negative key => value filter to the query referenced by the provided DataFrame refId. Used by Log details and Logs table.
   * onClickFilterOutLabel?: (key: string, value: string, frame?: DataFrame) => void;
   *
   * Adds a string filter to the query referenced by the provided DataFrame refId. Used by the Logs popover menu.
   * onClickFilterOutString?: (value: string, refId?: string) => void;
   *
   * Removes a string filter to the query referenced by the provided DataFrame refId. Used by the Logs popover menu.
   * onClickFilterString?: (value: string, refId?: string) => void;
   *
   * Determines if a given key => value filter is active in a given query. Used by Log details.
   * isFilterLabelActive?: (key: string, value: string, refId?: string) => Promise<boolean>;
   *
   * Array of field names to display instead of the log line. Pass a list of fields or an empty array to enable hide/show fields in Log Details.
   * displayedFields?: string[]
   *
   * Called from the "eye" icon in Log Details to request showing the displayed field. If ommited, a default implementation is used.
   * onClickShowField?: (key: string) => void;
   *
   * Called from the "eye" icon in Log Details to request hiding the displayed field. If ommited, a default implementation is used.
   * onClickHideField?: (key: string) => void;
   *
   * Called from the new Log Details Panel when fields are reordered. If ommited, a default implementation is used.
   * setDisplayedFields?: (key: string) => void;
   *
   * Passed to the LogLineMenu component to be rendered before the default actions in the menu.
   * logRowMenuIconsBefore?: ReactNode[];
   *
   * Passed to the LogLineMenu component to be rendered after the default actions in the menu.
   * logRowMenuIconsAfter?: ReactNode[];
   *
   * Callback to be invoked when enableInfiniteScrolling and new logs have been received after an scroll event.
   * onNewLogsReceived?: (allLogs: DataFrame[], newLogs: DataFrame[]) => void;
   *
   * Log Controls props:
   *
   * Enables a sidebar with controls for scrolling, sort order, deduplication, filtering, timestamps, wrapping, etc.
   * showControls?: boolean
   *
   * If controls are enabled, the component will use this key to store changes to the aforementioned options.
   * controlsStorageKey?: string
   *
   * If controls are enabled, this function is called when a change is made in one of the options from the controls.
   * onLogOptionsChange?: (option: LogListOptions, value: string | boolean | string[]) => void;
   *
   * You can pass extra options to the LogLineMenu component.
   * These options are an array of items with { label, onClick } or { divider: true } for dividers.
   * logLineMenuCustomItems?: LogLineMenuCustomItem[];
   *
   * Use the default, bigger, font size, or a smaller one. Defaults to "default".
   * fontSize?: 'default' | 'small'
   *
   * Set the mode used by the Log Details panel. Displayed as a sidebar, or inline below the log line. Defaults to "inline".
   * detailsMode?: 'inline' | 'sidebar'
   *
   * When showing timestamps, toggle between showing nanoseconds or milliseconds.
   * timestampResolution?: 'ms' | 'ns'
   *
   * Experimental. When OTel logs are displayed, add an extra displayed field with relevant key-value pairs from labels and metadata.
   * Requires the `otelLogsFormatting`.
   * @alpha
   * showLogAttributes?: boolean
   *
   * Custom Prism grammar definition for highlighting. When used, the .prism-syntax-highlight CSS class name is applied to the component, to allow standard token colors to be applied.
   * grammar?: Grammar
   */
}

export const LogsPanel = ({ data, timeZone, fieldConfig, options, onOptionsChange, height, id }: LogsPanelProps) => {
  const {
    allowDownload,
    showControls,
    showFieldSelector,
    controlsStorageKey,
    showLabels,
    showLevel,
    showTime,
    wrapLogMessage,
    prettifyLogMessage,
    sortOrder,
    dedupStrategy,
    enableLogDetails,
    showLogContextToggle,
    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickFilterOutString,
    onClickFilterString,
    onLogOptionsChange,
    isFilterLabelActive,
    logLineMenuCustomItems,
    enableInfiniteScrolling,
    onNewLogsReceived,
    fontSize,
    syntaxHighlighting,
    detailsMode: detailsModeProp,
    noInteractions,
    timestampResolution,
    showLogAttributes,
    unwrappedColumns,
    grammar,
  } = options;
  const style = useStyles2(getStyles);
  const [contextRow, setContextRow] = useState<LogRowModel | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [displayedFields, setDisplayedFields] = useState<string[]>(options.displayedFields ?? []);
  const [infiniteScrolling, setInfiniteScrolling] = useState(false);
  const loadingRef = useRef(false);
  const [panelData, setPanelData] = useState(data);
  const dataSourcesMap = useDatasourcesFromTargets(panelData.request?.targets);
  const closeCallback = useRef<(() => void) | undefined>(undefined);
  const { app, eventBus, onAddAdHocFilter } = usePanelContext();

  useEffect(() => {
    getAppEvents().publish(
      new LogSortOrderChangeEvent({
        order: sortOrder,
      })
    );
  }, [sortOrder]);

  const onLogRowHover = useCallback(
    (row?: LogRowModel) => {
      if (row) {
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

  const onLogContainerMouseLeave = useCallback(() => {
    eventBus.publish(new DataHoverClearEvent());
  }, [eventBus]);

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
          panelData.request?.app !== CoreApp.Dashboard &&
          panelData.request?.app !== CoreApp.PanelEditor &&
          panelData.request?.app !== CoreApp.PanelViewer)
      ) {
        return false;
      }

      const dataSource = dataSourcesMap.get(row.dataFrame.refId);
      return hasLogsContextSupport(dataSource);
    },
    [dataSourcesMap, showLogContextToggle, panelData.request?.app]
  );

  const showPermaLink = useCallback(() => {
    return !(
      panelData.request?.app !== CoreApp.Dashboard &&
      panelData.request?.app !== CoreApp.PanelEditor &&
      panelData.request?.app !== CoreApp.PanelViewer
    );
  }, [panelData.request?.app]);

  const getLogRowContext = useCallback(
    async (row: LogRowModel, origRow: LogRowModel, options: LogRowContextOptions): Promise<DataQueryResponse> => {
      if (!origRow.dataFrame.refId || !dataSourcesMap) {
        return Promise.resolve({ data: [] });
      }

      const query = panelData.request?.targets[0];
      if (!query) {
        return Promise.resolve({ data: [] });
      }

      const dataSource = dataSourcesMap.get(origRow.dataFrame.refId);
      if (!hasLogsContextSupport(dataSource)) {
        return Promise.resolve({ data: [] });
      }

      options.scopedVars = panelData.request?.scopedVars;

      return dataSource.getLogRowContext(row, options, query);
    },
    [panelData.request?.targets, panelData.request?.scopedVars, dataSourcesMap]
  );

  const getLogRowContextUi = useCallback(
    (origRow: LogRowModel, runContextQuery?: () => void): React.ReactNode => {
      if (!origRow.dataFrame.refId || !dataSourcesMap) {
        return <></>;
      }

      const query = panelData.request?.targets[0];
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

      return dataSource.getLogRowContextUi(origRow, runContextQuery, query, panelData.request?.scopedVars);
    },
    [panelData.request?.targets, panelData.request?.scopedVars, dataSourcesMap]
  );

  const [logRows, deduplicatedRows] = useMemo(() => {
    const logs = panelData
      ? dataFrameToLogsModel(
          panelData.series,
          panelData.request?.intervalMs,
          undefined,
          panelData.request?.targets,
          Boolean(enableInfiniteScrolling)
        )
      : null;
    const logRows = logs?.rows || [];
    const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
    return [logRows, deduplicatedRows];
  }, [dedupStrategy, enableInfiniteScrolling, panelData]);

  const onPermalinkClick = useCallback(
    async (row: LogRowModel) => {
      return await copyDashboardUrl(row, logRows, panelData.timeRange);
    },
    [panelData.timeRange, logRows]
  );

  useEffect(() => {
    if (data.state !== LoadingState.Loading) {
      setPanelData(data);
    }
  }, [data]);

  const getFieldLinks: GetFieldLinksFn = useCallback(
    (field, rowIndex, dataFrame, vars) => {
      return getFieldLinksForExplore({
        field,
        rowIndex,
        range: panelData.timeRange,
        dataFrame: dataFrame,
        vars,
      });
    },
    [panelData]
  );

  const handleOnClickFilterLabel = useCallback(
    (key: string, value: string) => {
      onAddAdHocFilter?.({
        key,
        value,
        operator: '=',
      });
    },
    [onAddAdHocFilter]
  );

  const handleOnClickFilterOutLabel = useCallback(
    (key: string, value: string) => {
      onAddAdHocFilter?.({
        key,
        value,
        operator: '!=',
      });
    },
    [onAddAdHocFilter]
  );

  const showField = useCallback(
    (key: string) => {
      const index = displayedFields?.indexOf(key);
      if (index === -1) {
        const newDisplayedFields = displayedFields?.concat(key);
        setDisplayedFields(newDisplayedFields);
        onOptionsChange({
          ...options,
          displayedFields: newDisplayedFields,
        });
      }
    },
    [displayedFields, onOptionsChange, options]
  );

  const hideField = useCallback(
    (key: string) => {
      const index = displayedFields?.indexOf(key);
      if (index !== undefined && index > -1) {
        const newDisplayedFields = displayedFields?.filter((k) => key !== k);
        setDisplayedFields(newDisplayedFields);
        onOptionsChange({
          ...options,
          displayedFields: newDisplayedFields,
        });
      }
    },
    [displayedFields, onOptionsChange, options]
  );

  useEffect(() => {
    if (options.displayedFields) {
      setDisplayedFields(options.displayedFields);
    }
  }, [options.displayedFields]);

  const loadMoreLogs = useCallback(
    async (scrollRange: AbsoluteTimeRange) => {
      if (!data.request || loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      setInfiniteScrolling(true);

      const onNewLogsReceivedCallback = isOnNewLogsReceivedType(onNewLogsReceived) ? onNewLogsReceived : undefined;

      let newSeries: DataFrame[] = [];
      try {
        newSeries = await requestMoreLogs(dataSourcesMap, panelData, scrollRange, timeZone, onNewLogsReceivedCallback);
        const panel = getDashboardSrv().getCurrent()?.getPanelById(id);
        if (panel?.transformations) {
          newSeries = await lastValueFrom(transformDataFrame(panel?.transformations, newSeries));
        }
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
    [data.request, dataSourcesMap, id, onNewLogsReceived, panelData, timeZone]
  );

  const initialScrollPosition = useMemo(() => {
    if (app === CoreApp.Dashboard || app === CoreApp.PanelEditor) {
      return sortOrder === LogsSortOrder.Ascending ? 'bottom' : 'top';
    }
    return 'top';
  }, [app, sortOrder]);

  const storageKey = useMemo(() => {
    if (controlsStorageKey) {
      return controlsStorageKey;
    }
    if (!data.request) {
      return undefined;
    }
    return `${data.request?.dashboardUID}.${id}`;
  }, [controlsStorageKey, data.request, id]);

  if (!data || logRows.length === 0) {
    return (
      <PanelDataErrorView
        fieldConfig={fieldConfig}
        panelId={id}
        data={data}
        needsStringField={isMissingStringField(panelData.series)}
        needsTimeField={isMissingTimeField(panelData.series)}
      />
    );
  }

  const defaultOnClickFilterLabel = onAddAdHocFilter ? handleOnClickFilterLabel : undefined;
  const defaultOnClickFilterOutLabel = onAddAdHocFilter ? handleOnClickFilterOutLabel : undefined;

  const onClickShowField = isOnClickShowField(options.onClickShowField) ? options.onClickShowField : showField;
  const onClickHideField = isOnClickHideField(options.onClickHideField) ? options.onClickHideField : hideField;
  const setDisplayedFieldsFn = isSetDisplayedFields(options.setDisplayedFields)
    ? options.setDisplayedFields
    : setDisplayedFields;

  const detailsMode = detailsModeProp ? detailsModeProp : app === CoreApp.Dashboard ? 'inline' : undefined;

  return (
    <>
      {getLogRowContext && contextRow && (
        <LogLineContext
          open={contextRow !== null}
          log={contextRow}
          onClose={onCloseContext}
          getRowContext={(row, options) => getLogRowContext(row, contextRow, options)}
          getLogRowContextUi={getLogRowContextUi}
          logOptionsStorageKey={storageKey}
          logLineMenuCustomItems={isLogLineMenuCustomItems(logLineMenuCustomItems) ? logLineMenuCustomItems : undefined}
          timeZone={timeZone}
          displayedFields={displayedFields}
        />
      )}
      <div
        onMouseLeave={onLogContainerMouseLeave}
        className={style.logListContainer}
        style={height ? { minHeight: height } : undefined}
        ref={(element: HTMLDivElement) => {
          setScrollElement(element);
        }}
      >
        {deduplicatedRows.length > 0 && scrollElement && (
          <LogList
            allowDownload={allowDownload}
            app={isCoreApp(app) ? app : CoreApp.Dashboard}
            containerElement={scrollElement}
            dataFrames={panelData.series}
            dedupStrategy={dedupStrategy}
            detailsMode={detailsMode}
            displayedFields={displayedFields}
            enableLogDetails={enableLogDetails}
            fontSize={fontSize}
            getFieldLinks={getFieldLinks}
            grammar={isGrammar(grammar) ? grammar : undefined}
            isLabelFilterActive={isIsFilterLabelActive(isFilterLabelActive) ? isFilterLabelActive : undefined}
            initialScrollPosition={initialScrollPosition}
            loading={infiniteScrolling}
            logLineMenuCustomItems={
              isLogLineMenuCustomItems(logLineMenuCustomItems) ? logLineMenuCustomItems : undefined
            }
            logs={deduplicatedRows}
            logSupportsContext={showContextToggle}
            loadMore={enableInfiniteScrolling ? loadMoreLogs : undefined}
            noInteractions={noInteractions}
            onClickFilterLabel={
              isOnClickFilterLabel(onClickFilterLabel) ? onClickFilterLabel : defaultOnClickFilterLabel
            }
            onClickFilterOutLabel={
              isOnClickFilterOutLabel(onClickFilterOutLabel) ? onClickFilterOutLabel : defaultOnClickFilterOutLabel
            }
            onClickFilterString={isOnClickFilterString(onClickFilterString) ? onClickFilterString : undefined}
            onClickFilterOutString={
              isOnClickFilterOutString(onClickFilterOutString) ? onClickFilterOutString : undefined
            }
            onClickShowField={displayedFields !== undefined ? onClickShowField : undefined}
            onClickHideField={displayedFields !== undefined ? onClickHideField : undefined}
            onLogLineHover={onLogRowHover}
            onLogOptionsChange={isOnLogOptionsChange(onLogOptionsChange) ? onLogOptionsChange : undefined}
            onOpenContext={onOpenContext}
            onPermalinkClick={showPermaLink() ? onPermalinkClick : undefined}
            permalinkedLogId={getLogsPanelState()?.logs?.id ?? undefined}
            prettifyJSON={prettifyLogMessage}
            setDisplayedFields={setDisplayedFieldsFn}
            showControls={Boolean(showControls)}
            showFieldSelector={showFieldSelector}
            showLogAttributes={showLogAttributes}
            showLevel={storageKey ? store.getBool(`${storageKey}.showLevel`, showLevel ?? true) : showLevel}
            showTime={showTime}
            showUniqueLabels={showLabels}
            sortOrder={sortOrder}
            logOptionsStorageKey={storageKey}
            syntaxHighlighting={syntaxHighlighting}
            timeRange={data.timeRange}
            timestampResolution={timestampResolution}
            timeZone={timeZone}
            unwrappedColumns={unwrappedColumns}
            wrapLogMessage={wrapLogMessage}
          />
        )}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  logListContainer: css({
    minHeight: '100%',
    maxHeight: '100%',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  }),
});

async function copyDashboardUrl(row: LogRowModel, rows: LogRowModel[], timeRange: TimeRange) {
  if (row.rowId === undefined || !row.dataFrame.refId) {
    return;
  }

  const panelState = {
    logs: { id: row.uid },
  };

  const currentURL = new URL(window.location.href);

  currentURL.searchParams.set('panelState', JSON.stringify(panelState));
  const range = getLogsPermalinkRange(row, rows, {
    from: toUtc(timeRange.from).valueOf(),
    to: toUtc(timeRange.to).valueOf(),
  });
  currentURL.searchParams.set('from', range.from.toString());
  currentURL.searchParams.set('to', range.to.toString());

  await createAndCopyShortLink(currentURL.toString());

  return Promise.resolve();
}

async function requestMoreLogs(
  dataSourcesMap: Map<string, DataSourceApi>,
  panelData: PanelData,
  timeRange: AbsoluteTimeRange,
  timeZone: TimeZone,
  onNewLogsReceived?: onNewLogsReceivedType
) {
  if (!panelData.request) {
    return [];
  }

  const range: TimeRange = rangeUtil.convertRawToRange({
    from: dateTimeForTimeZone(timeZone, timeRange.from),
    to: dateTimeForTimeZone(timeZone, timeRange.to),
  });

  const targetGroups = groupBy(panelData.request.targets, 'datasource.uid');
  const dataRequests = [];

  for (const uid in targetGroups) {
    const dataSource = dataSourcesMap.get(panelData.request.targets[0].refId);
    if (!dataSource) {
      console.warn(`Could not resolve data source for target ${panelData.request.targets[0].refId}`);
      continue;
    }
    dataRequests.push(
      dataSource.query({
        ...panelData.request,
        range,
        targets: targetGroups[uid],
      })
    );
  }

  const responses = await Promise.all(dataRequests);
  let updatedSeries = panelData.series;
  for (const response of responses) {
    const newData = isObservable(response) ? await lastValueFrom(response) : response;

    updatedSeries = combineResponses(
      {
        data: updatedSeries,
      },
      { data: newData.data }
    ).data;

    if (onNewLogsReceived) {
      onNewLogsReceived(updatedSeries, newData.data);
    }
  }

  return updatedSeries;
}
