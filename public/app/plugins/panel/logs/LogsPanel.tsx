import { css, cx } from '@emotion/css';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  CoreApp,
  DataHoverClearEvent,
  DataHoverEvent,
  DataQueryResponse,
  Field,
  GrafanaTheme2,
  hasLogsContextSupport,
  Labels,
  LogRowContextOptions,
  LogRowModel,
  LogsSortOrder,
  PanelProps,
  toUtc,
  urlUtil,
} from '@grafana/data';
import { CustomScrollbar, usePanelContext, useStyles2 } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { LogRowContextModal } from 'app/features/logs/components/log-context/LogRowContextModal';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';

import { getDashboardUid } from '../../../../../e2e/utils/support/url';
import { createAndCopyShortLink } from '../../../core/utils/shortLinks';
import { getDashboardUrl } from '../../../features/dashboard-scene/utils/urlBuilders';
import { LogLabels } from '../../../features/logs/components/LogLabels';
import { LogRows } from '../../../features/logs/components/LogRows';
import { COMMON_LABELS, dataFrameToLogsModel, dedupLogRows } from '../../../features/logs/logsModel';

import { Options } from './types';
import { useDatasourcesFromTargets } from './useDatasourcesFromTargets';

interface LogsPanelProps extends PanelProps<Options> {}

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
  const [closeCallback, setCloseCallback] = useState<(() => void) | null>(null);
  const timeRange = data.timeRange;

  const dataSourcesMap = useDatasourcesFromTargets(data.request?.targets);

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
    if (closeCallback) {
      closeCallback();
    }
  }, [closeCallback]);

  const onOpenContext = useCallback((row: LogRowModel, onClose: () => void) => {
    setContextRow(row);
    setCloseCallback(onClose);
  }, []);

  const onPermalinkClick = useCallback(
    async (row: LogRowModel) => {
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

      // Create absolute timerange
      const range = {
        from: toUtc(timeRange.from).valueOf(),
        to: toUtc(timeRange.to).valueOf(),
      };
      const location = window.location;

      // append changed urlState to baseUrl
      const baseUrl = /.*(?=\/d)/.exec(`${location.href}`)![0];
      const exploreUrl = urlUtil.renderUrl(`${baseUrl}/d`, {
        panelState: JSON.stringify(panelState),
        from: range?.from,
        to: range?.to,
      });

      const urlSearchParams = new URL(exploreUrl).searchParams;

      const uid = getDashboardUid(location.href);
      const url = getDashboardUrl({
        uid: uid,
        currentQueryParams: urlSearchParams.toString(),
        updateQuery: { viewPanel: null, inspect: null, editview: null },
        // subPath: `/logs/${row.rowId}`,
      });

      await createAndCopyShortLink(url);

      return Promise.resolve();
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
        />
      )}
      <CustomScrollbar autoHide scrollTop={scrollTop}>
        <div className={style.container} ref={logsContainerRef}>
          {showCommonLabels && !isAscending && renderCommonLabels()}
          <LogRows
            onPermalinkClick={onPermalinkClick}
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
