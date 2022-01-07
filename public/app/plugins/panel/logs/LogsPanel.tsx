import React, { useCallback, useMemo, useLayoutEffect, useState, useEffect } from 'react';
import { css } from '@emotion/css';
import { LogRows, CustomScrollbar, LogLabels, useStyles2, usePanelContext } from '@grafana/ui';
import {
  PanelProps,
  Field,
  Labels,
  GrafanaTheme2,
  LogsSortOrder,
  LogRowModel,
  DataHoverClearEvent,
  DataHoverEvent,
} from '@grafana/data';
import { Options } from './types';
import { dataFrameToLogsModel, dedupLogRows } from 'app/core/logs_model';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { COMMON_LABELS } from '../../../core/logs_model';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';
import { cloneDeep } from 'lodash';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel: React.FunctionComponent<LogsPanelProps> = ({
  data,
  timeZone,
  options: {
    showLabels,
    showTime,
    wrapLogMessage,
    showCommonLabels,
    prettifyLogMessage,
    sortOrder,
    dedupStrategy,
    enableLogDetails,
  },
  title,
  id,
}) => {
  const isAscending = sortOrder === LogsSortOrder.Ascending;
  const style = useStyles2(getStyles(title, isAscending));
  const [scrollTop, setScrollTop] = useState(0);
  const [newData, setNewData] = useState(data);

  useEffect(() => {
    setNewData(data);
  }, [data]);

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

  // Important to memoize stuff here, as panel rerenders a lot for example when resizing.
  const [logRows, deduplicatedRows, commonLabels] = useMemo(() => {
    const newResults = newData ? dataFrameToLogsModel(newData.series, newData.request?.intervalMs) : null;
    const logRows = newResults?.rows || [];
    const commonLabels = newResults?.meta?.find((m) => m.label === COMMON_LABELS);
    const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
    return [logRows, deduplicatedRows, commonLabels];
  }, [newData, dedupStrategy]);

  useLayoutEffect(() => {
    const scrollbar = document.querySelector('.scrollbar-view');
    // the height of each log
    const logRowHeight = document.querySelector('tbody')?.children[0].clientHeight;
    // the height of all of the logs
    const logHeight = scrollbar?.clientHeight;
    // the new height the log panel is going to have once the new log is added
    const newLogHeight = logRowHeight && logHeight ? logRowHeight + logHeight : 0;

    if (isAscending && scrollbar) {
      if (newLogHeight < scrollbar.scrollHeight) {
        // if the scrollbar is present, we check if the user is scrolled at the bottom to
        // determine if we are gonna scroll all the way down when a new log comes in
        // or if we are gonna keep our scroll position
        if (scrollbar.scrollHeight - scrollbar.scrollTop === newLogHeight) {
          setScrollTop(scrollbar.scrollHeight);
        } else {
          setScrollTop(scrollbar.scrollTop);
        }
      } else {
        // if the scrollbar is not present, we scroll to the bottom by default
        // so when it starts to be present, its at the bottom position by default
        // until the user scrolls up
        setScrollTop(scrollbar.scrollHeight);
      }
    }
  }, [isAscending, logRows]);

  const getFieldLinks = useCallback(
    (field: Field, rowIndex: number) => {
      return getFieldLinksForExplore({ field, rowIndex, range: newData.timeRange });
    },
    [newData]
  );

  useEffect(() => {
    const postMessage = (msg: any) => {
      const clonedData = cloneDeep(newData);
      const fields = clonedData.series[0].fields;
      const time = fields[0];
      const message = fields[1];
      const containerId = fields[2];
      const hostname = fields[3];
      //@ts-ignore
      time.values.add(Date.now());
      //@ts-ignore
      message.values.add(msg.data);
      //@ts-ignore
      containerId.values.add('fusebit');
      //@ts-ignore
      hostname.values.add('fusebit');

      clonedData.series[0].length++;
      console.log(clonedData);
      setNewData(clonedData);
      console.log('Message Received from parent: ', msg.data);
    };

    window.addEventListener('message', postMessage);

    return () => {
      window.removeEventListener('message', postMessage);
    };
  }, [newData]);

  if (!newData || logRows.length === 0) {
    return <PanelDataErrorView panelId={id} data={newData} needsStringField />;
  }

  const renderCommonLabels = () => (
    <div className={style.labelContainer}>
      <span className={style.label}>Common labels:</span>
      <LogLabels labels={commonLabels ? (commonLabels.value as Labels) : { labels: '(no common labels)' }} />
    </div>
  );

  return (
    <CustomScrollbar autoHide scrollTop={scrollTop}>
      <div className={style.container}>
        {showCommonLabels && !isAscending && renderCommonLabels()}
        <LogRows
          logRows={logRows}
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
        />
        {showCommonLabels && isAscending && renderCommonLabels()}
      </div>
    </CustomScrollbar>
  );
};

const getStyles = (title: string, isAscending: boolean) => (theme: GrafanaTheme2) => ({
  container: css`
    margin-bottom: ${theme.spacing(1.5)};
    //We can remove this hot-fix when we fix panel menu with no title overflowing top of all panels
    margin-top: ${theme.spacing(!title ? 2.5 : 0)};
  `,
  labelContainer: css`
    margin: ${isAscending ? theme.spacing(0.5, 0, 0.5, 0) : theme.spacing(0, 0, 0.5, 0.5)};
    display: flex;
    align-items: center;
  `,
  label: css`
    margin-right: ${theme.spacing(0.5)};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});
