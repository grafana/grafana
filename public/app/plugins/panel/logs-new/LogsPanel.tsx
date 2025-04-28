import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  AbsoluteTimeRange,
  CoreApp,
  DataFrame,
  DataHoverEvent,
  GrafanaTheme2,
  LoadingState,
  LogRowModel,
  LogSortOrderChangeEvent,
  LogsSortOrder,
  PanelProps,
} from '@grafana/data';
import { config, getAppEvents } from '@grafana/runtime';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { LogList } from 'app/features/logs/components/panel/LogList';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';

import { dataFrameToLogsModel, dedupLogRows } from '../../../features/logs/logsModel';
import { requestMoreLogs } from '../logs/LogsPanel';
import { useDatasourcesFromTargets } from '../logs/useDatasourcesFromTargets';

import { Options } from './panelcfg.gen';
import { isCoreApp, isLogsGrammar, isOnLogOptionsChange, isOnNewLogsReceivedType } from './types';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel = ({
  data,
  timeZone,
  fieldConfig,
  options: {
    dedupStrategy,
    enableInfiniteScrolling,
    grammar,
    onLogOptionsChange,
    onNewLogsReceived,
    showControls,
    showTime,
    sortOrder,
    syntaxHighlighting,
    wrapLogMessage,
  },
  id,
}: LogsPanelProps) => {
  const style = useStyles2(getStyles);
  const [logsContainer, setLogsContainer] = useState<HTMLDivElement | null>(null);
  const [panelData, setPanelData] = useState(data);
  const dataSourcesMap = useDatasourcesFromTargets(data.request?.targets);
  // Prevents the scroll position to change when new data from infinite scrolling is received
  const keepScrollPositionRef = useRef(false);
  // Loading ref to prevent firing multiple requests
  const loadingRef = useRef(false);
  const { app, eventBus } = usePanelContext();

  const logs = useMemo(() => {
    const logsModel = panelData
      ? dataFrameToLogsModel(panelData.series, panelData.request?.intervalMs, undefined, panelData.request?.targets)
      : null;
    return logsModel ? dedupLogRows(logsModel.rows, dedupStrategy) : [];
  }, [dedupStrategy, panelData]);

  useEffect(() => {
    getAppEvents().publish(
      new LogSortOrderChangeEvent({
        order: sortOrder,
      })
    );
  }, [sortOrder]);

  useEffect(() => {
    if (data.state !== LoadingState.Loading) {
      setPanelData(data);
    }
  }, [data]);

  const loadMoreLogs = useCallback(
    async (scrollRange: AbsoluteTimeRange) => {
      if (!data.request || !config.featureToggles.logsInfiniteScrolling || loadingRef.current) {
        return;
      }
      loadingRef.current = true;

      const onNewLogsReceivedCallback = isOnNewLogsReceivedType(onNewLogsReceived) ? onNewLogsReceived : undefined;

      let newSeries: DataFrame[] = [];
      try {
        newSeries = await requestMoreLogs(dataSourcesMap, panelData, scrollRange, timeZone, onNewLogsReceivedCallback);
      } catch (e) {
        console.error(e);
      } finally {
        loadingRef.current = false;
      }

      keepScrollPositionRef.current = true;
      setPanelData({
        ...panelData,
        series: newSeries,
      });
    },
    [data.request, dataSourcesMap, onNewLogsReceived, panelData, timeZone]
  );

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

  const initialScrollPosition = useMemo(() => {
    /**
     * In dashboards, users with newest logs at the bottom have the expectation of keeping the scroll at the bottom
     * when new data is received. See https://github.com/grafana/grafana/pull/37634
     */
    if (data.request?.app === CoreApp.Dashboard || data.request?.app === CoreApp.PanelEditor) {
      return sortOrder === LogsSortOrder.Ascending ? 'bottom' : 'top';
    }
    return 'top';
  }, [data.request?.app, sortOrder]);

  if (!logs.length) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div className={style.container} ref={(element: HTMLDivElement) => setLogsContainer(element)}>
      {logs.length > 0 && logsContainer && (
        <LogList
          app={isCoreApp(app) ? app : CoreApp.Dashboard}
          containerElement={logsContainer}
          dedupStrategy={dedupStrategy}
          displayedFields={[]}
          enableLogDetails
          grammar={isLogsGrammar(grammar) ? grammar : undefined}
          initialScrollPosition={initialScrollPosition}
          logs={logs}
          loadMore={enableInfiniteScrolling ? loadMoreLogs : undefined}
          onLogOptionsChange={isOnLogOptionsChange(onLogOptionsChange) ? onLogOptionsChange : undefined}
          onLogLineHover={onLogRowHover}
          showControls={showControls}
          showTime={showTime}
          sortOrder={sortOrder}
          syntaxHighlighting={syntaxHighlighting}
          timeRange={data.timeRange}
          timeZone={timeZone}
          wrapLogMessage={wrapLogMessage}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(1.5),
    minHeight: '100%',
    maxHeight: '100%',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
  }),
});
