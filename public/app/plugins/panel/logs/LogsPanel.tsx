import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo, useRef, useLayoutEffect, useState, useEffect } from 'react';
import { isObservable, lastValueFrom } from 'rxjs';

import {
  PanelProps,
  Field,
  Labels,
  GrafanaTheme2,
  LogsSortOrder,
  LogRowModel,
  DataHoverClearEvent,
  DataHoverEvent,
  CoreApp,
  AbsoluteTimeRange,
  dateTimeForTimeZone,
  TimeRange,
} from '@grafana/data';
import { convertRawToRange } from '@grafana/data/src/datetime/rangeutil';
import { getDataSourceSrv } from '@grafana/runtime';
import { CustomScrollbar, useStyles2, usePanelContext } from '@grafana/ui';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { InfiniteScroll } from 'app/features/logs/components/InfiniteScroll';
import { PanelDataErrorView } from 'app/features/panel/components/PanelDataErrorView';
import { combineResponses } from 'app/plugins/datasource/loki/responseUtils';

import { LogLabels } from '../../../features/logs/components/LogLabels';
import { LogRows } from '../../../features/logs/components/LogRows';
import { dataFrameToLogsModel, dedupLogRows, COMMON_LABELS } from '../../../features/logs/logsModel';

import { Options } from './types';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel = ({
  data,
  timeZone,
  fieldConfig,
  timeRange,
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
  id,
}: LogsPanelProps) => {
  const isAscending = sortOrder === LogsSortOrder.Ascending;
  const style = useStyles2(getStyles);
  const [scrollTop, setScrollTop] = useState(0);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | undefined>(undefined);
  const [infiniteScrolling, setInfiniteScrolling] = useState(false);
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

  // Important to memoize stuff here, as panel rerenders a lot for example when resizing.
  const [logRows, deduplicatedRows, commonLabels] = useMemo(() => {
    const logs = panelData
      ? dataFrameToLogsModel(panelData.series, data.request?.intervalMs, undefined, data.request?.targets)
      : null;
    const logRows = logs?.rows || [];
    const commonLabels = logs?.meta?.find((m) => m.label === COMMON_LABELS);
    const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
    return [logRows, deduplicatedRows, commonLabels];
  }, [data.request?.intervalMs, data.request?.targets, dedupStrategy, panelData]);

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

  const loadMoreLogs = useCallback(
    async (scrollRange: AbsoluteTimeRange) => {
      if (!data.request) {
        return;
      }
      const range: TimeRange = convertRawToRange({
        from: dateTimeForTimeZone(timeZone, scrollRange.from),
        to: dateTimeForTimeZone(timeZone, scrollRange.to),
      });
      const dataRequests = [];
      for (const query of data.request.targets) {
        const dataSource = await getDataSourceSrv().get(query.datasource?.uid);
        if (!dataSource) {
          continue;
        }
        dataRequests.push(
          dataSource.query({
            ...data.request,
            range,
            targets: [query],
          })
        );
      }
      setInfiniteScrolling(true);

      const responses = await Promise.all(dataRequests);
      let newSeries = panelData.series;
      for (const response of responses) {
        if (!isObservable(response)) {
          continue;
        }
        const newData = await lastValueFrom(response);
        newSeries = combineResponses(
          {
            data: newSeries,
          },
          { data: newData.data }
        ).data;
      }

      setPanelData({
        ...panelData,
        series: newSeries,
      });

      setInfiniteScrolling(false);
    },
    [data.request, panelData, timeZone]
  );

  if (!panelData || logRows.length === 0) {
    return <PanelDataErrorView fieldConfig={fieldConfig} panelId={id} data={panelData} needsStringField />;
  }

  const renderCommonLabels = () => (
    <div className={cx(style.labelContainer, isAscending && style.labelContainerAscending)}>
      <span className={style.label}>Common labels:</span>
      <LogLabels labels={commonLabels ? (commonLabels.value as Labels) : { labels: '(no common labels)' }} />
    </div>
  );

  return (
    <CustomScrollbar
      autoHide
      scrollTop={scrollTop}
      scrollRefCallback={(element) => {
        setScrollElement(element || undefined);
      }}
    >
      <div className={style.container} ref={logsContainerRef} id="caca">
        {showCommonLabels && !isAscending && renderCommonLabels()}
        <InfiniteScroll
          loading={infiniteScrolling}
          loadMoreLogs={loadMoreLogs}
          range={timeRange}
          timeZone={timeZone}
          rows={logRows}
          scrollElement={scrollElement}
          sortOrder={sortOrder}
        >
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
            app={CoreApp.Dashboard}
          />
        </InfiniteScroll>
        {showCommonLabels && isAscending && renderCommonLabels()}
      </div>
    </CustomScrollbar>
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
