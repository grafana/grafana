import { css } from '@emotion/css';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { CoreApp, GrafanaTheme2, LogsSortOrder, PanelProps } from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { LogList } from 'app/features/logs/components/panel/LogList';
import { ScrollToLogsEvent } from 'app/features/logs/components/panel/virtualization';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';

import { dataFrameToLogsModel, dedupLogRows } from '../../../features/logs/logsModel';

import { Options } from './panelcfg.gen';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel = ({
  data,
  timeZone,
  fieldConfig,
  options: { showTime, wrapLogMessage, sortOrder, dedupStrategy },
  id,
}: LogsPanelProps) => {
  const isAscending = sortOrder === LogsSortOrder.Ascending;
  const style = useStyles2(getStyles);
  const [logsContainer, setLogsContainer] = useState<HTMLDivElement | null>(null);
  const [panelData, setPanelData] = useState(data);
  // Prevents the scroll position to change when new data from infinite scrolling is received
  const keepScrollPositionRef = useRef(false);
  const { eventBus } = usePanelContext();

  const logs = useMemo(() => {
    const logsModel = panelData
      ? dataFrameToLogsModel(panelData.series, data.request?.intervalMs, undefined, data.request?.targets)
      : null;
    return logsModel ? dedupLogRows(logsModel.rows, dedupStrategy) : [];
  }, [data.request?.intervalMs, data.request?.targets, dedupStrategy, panelData]);

  useEffect(() => {
    setPanelData(data);
  }, [data]);

  useLayoutEffect(() => {
    if (keepScrollPositionRef.current) {
      keepScrollPositionRef.current = false;
      return;
    }
    /**
     * In dashboards, users with newest logs at the bottom have the expectation of keeping the scroll at the bottom
     * when new data is received. See https://github.com/grafana/grafana/pull/37634
     */
    if (data.request?.app === CoreApp.Dashboard || data.request?.app === CoreApp.PanelEditor) {
      eventBus.publish(
        new ScrollToLogsEvent({
          scrollTo: isAscending ? 'top' : 'bottom',
        })
      );
    }
  }, [data.request?.app, eventBus, isAscending, logs]);

  if (!logs.length) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={data} needsStringField />;
  }

  return (
    <div className={style.container} ref={(element: HTMLDivElement) => setLogsContainer(element)}>
      {logs.length > 0 && logsContainer && (
        <LogList
          app={CoreApp.Dashboard}
          containerElement={logsContainer}
          eventBus={eventBus}
          logs={logs}
          showTime={showTime}
          sortOrder={sortOrder}
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
