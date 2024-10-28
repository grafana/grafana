import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';

import {
  CoreApp,
  DataHoverClearEvent,
  DataHoverEvent,
  DataQueryResponse,
  Field,
  GrafanaTheme2,
  hasLogsContextSupport,
  hasLogsContextUiSupport,
  Labels,
  LogRowContextOptions,
  LogRowModel,
  LogsSortOrder,
  PanelProps,
  TimeRange,
  toUtc,
  urlUtil,
} from '@grafana/data';
import { CustomScrollbar, usePanelContext, useStyles2 } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { LogRowContextModal } from 'app/features/logs/components/log-context/LogRowContextModal';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';

import { createAndCopyShortLink } from '../../../core/utils/shortLinks';
import { LogLabels } from '../../../features/logs/components/LogLabels';
import { LogRows } from '../../../features/logs/components/LogRows';
import { COMMON_LABELS, dataFrameToLogsModel, dedupLogRows } from '../../../features/logs/logsModel';

import {
  isIsFilterLabelActive,
  isOnClickFilterLabel,
  isOnClickFilterOutLabel,
  isOnClickFilterOutString,
  isOnClickFilterString,
  isOnClickHideField,
  isOnClickShowField,
  isReactNodeArray,
  Options,
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
   * Passed to the LogRowMenuCell component to be rendered before the default actions in the menu.
   * logRowMenuIconsBefore?: ReactNode[];
   *
   * Passed to the LogRowMenuCell component to be rendered after the default actions in the menu.
   * logRowMenuIconsAfter?: ReactNode[];
   */
}
interface LogsPermalinkUrlState {
  logs?: {
    id?: string;
  };
}

const noCommonLabels: Labels = {};

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
    onClickFilterLabel,
    onClickFilterOutLabel,
    onClickFilterOutString,
    onClickFilterString,
    isFilterLabelActive,
    logRowMenuIconsBefore,
    logRowMenuIconsAfter,
    ...options
  },
  id,
}: LogsPanelProps) => {
  const isAscending = sortOrder === LogsSortOrder.Ascending;
  const style = useStyles2(getStyles);
  const [scrollTop, setScrollTop] = useState(0);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [contextRow, setContextRow] = useState<LogRowModel | null>(null);
  const timeRange = data.timeRange;
  const dataSourcesMap = useDatasourcesFromTargets(data.request?.targets);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [displayedFields, setDisplayedFields] = useState<string[]>(options.displayedFields ?? []);
  let closeCallback = useRef<() => void>();

  const { eventBus, onAddAdHocFilter } = usePanelContext();
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

  const onPermalinkClick = useCallback(
    async (row: LogRowModel) => {
      return await copyDashboardUrl(row, timeRange);
    },
    [timeRange]
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
    const logs = data
      ? dataFrameToLogsModel(data.series, data.request?.intervalMs, undefined, data.request?.targets)
      : null;
    const logRows = logs?.rows || [];
    const commonLabels = logs?.meta?.find((m) => m.label === COMMON_LABELS);
    const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
    return [logRows, deduplicatedRows, commonLabels];
  }, [data, dedupStrategy]);

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
        setDisplayedFields(displayedFields?.concat(key));
      }
    },
    [displayedFields]
  );

  const hideField = useCallback(
    (key: string) => {
      const index = displayedFields?.indexOf(key);
      if (index !== undefined && index > -1) {
        setDisplayedFields(displayedFields?.filter((k) => key !== k));
      }
    },
    [displayedFields]
  );

  useEffect(() => {
    if (options.displayedFields) {
      setDisplayedFields(options.displayedFields);
    }
  }, [options.displayedFields]);

  if (!data || logRows.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  const renderCommonLabels = () => (
    <div className={cx(style.labelContainer, isAscending && style.labelContainerAscending)}>
      <span className={style.label}>Common labels:</span>
      <LogLabels
        labels={typeof commonLabels?.value === 'object' ? commonLabels?.value : noCommonLabels}
        emptyMessage="(no common labels)"
      />
    </div>
  );

  // Passing callbacks control the display of the filtering buttons. We want to pass it only if onAddAdHocFilter is defined.
  const defaultOnClickFilterLabel = onAddAdHocFilter ? handleOnClickFilterLabel : undefined;
  const defaultOnClickFilterOutLabel = onAddAdHocFilter ? handleOnClickFilterOutLabel : undefined;

  const onClickShowField = isOnClickShowField(options.onClickShowField) ? options.onClickShowField : showField;
  const onClickHideField = isOnClickHideField(options.onClickHideField) ? options.onClickHideField : hideField;

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
        scrollRefCallback={(scrollElement) => setScrollElement(scrollElement)}
      >
        <div onMouseLeave={onLogContainerMouseLeave} className={style.container} ref={logsContainerRef}>
          {showCommonLabels && !isAscending && renderCommonLabels()}
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
            isFilterLabelActive={isIsFilterLabelActive(isFilterLabelActive) ? isFilterLabelActive : undefined}
            displayedFields={displayedFields}
            onClickShowField={displayedFields !== undefined ? onClickShowField : undefined}
            onClickHideField={displayedFields !== undefined ? onClickHideField : undefined}
            logRowMenuIconsBefore={isReactNodeArray(logRowMenuIconsBefore) ? logRowMenuIconsBefore : undefined}
            logRowMenuIconsAfter={isReactNodeArray(logRowMenuIconsAfter) ? logRowMenuIconsAfter : undefined}
          />
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

async function copyDashboardUrl(row: LogRowModel, timeRange: TimeRange) {
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
  currentURL.searchParams.set('from', toUtc(timeRange.from).valueOf().toString(10));
  currentURL.searchParams.set('to', toUtc(timeRange.to).valueOf().toString(10));

  await createAndCopyShortLink(currentURL.toString());

  return Promise.resolve();
}
