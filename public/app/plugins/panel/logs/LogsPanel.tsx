import React, { useCallback, useMemo } from 'react';
import { css } from '@emotion/css';
import { LogRows, CustomScrollbar, LogLabels, useStyles2 } from '@grafana/ui';
import { PanelProps, Field, Labels, GrafanaTheme2 } from '@grafana/data';
import { Options } from './types';
import { dataFrameToLogsModel, dedupLogRows } from 'app/core/logs_model';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { COMMON_LABELS } from '../../../core/logs_model';

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
}) => {
  const style = useStyles2(getStyles(title));

  // Important to memoize stuff here, as panel rerenders a lot for example when resizing.
  const [logRows, deduplicatedRows, commonLabels] = useMemo(() => {
    const newResults = data ? dataFrameToLogsModel(data.series, data.request?.intervalMs) : null;
    const logRows = newResults?.rows || [];
    const commonLabels = newResults?.meta?.find((m) => m.label === COMMON_LABELS);
    const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);
    return [logRows, deduplicatedRows, commonLabels];
  }, [data, dedupStrategy]);

  const getFieldLinks = useCallback(
    (field: Field, rowIndex: number) => {
      return getFieldLinksForExplore({ field, rowIndex, range: data.timeRange });
    },
    [data]
  );

  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <CustomScrollbar autoHide>
      <div className={style.container}>
        {showCommonLabels && (
          <div className={style.labelContainer}>
            <span className={style.label}>Common labels:</span>
            <LogLabels labels={commonLabels ? (commonLabels.value as Labels) : { labels: '(no common labels)' }} />
          </div>
        )}
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
        />
      </div>
    </CustomScrollbar>
  );
};

const getStyles = (title: string) => (theme: GrafanaTheme2) => ({
  container: css`
    margin-bottom: ${theme.spacing(1.5)};
    //We can remove this hot-fix when we fix panel menu with no title overflowing top of all panels
    margin-top: ${theme.spacing(!title ? 2.5 : 0)};
  `,
  labelContainer: css`
    margin: ${theme.spacing(0, 0, 0.5, 0.5)};
    display: flex;
    align-items: center;
  `,
  label: css`
    margin-right: ${theme.spacing(0.5)};
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});
