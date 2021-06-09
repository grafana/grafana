import React from 'react';
import { css } from '@emotion/css';
import { LogRows, CustomScrollbar, useTheme2 } from '@grafana/ui';
import { PanelProps, Field } from '@grafana/data';
import { Options } from './types';
import { dataFrameToLogsModel, dedupLogRows } from 'app/core/logs_model';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel: React.FunctionComponent<LogsPanelProps> = ({
  data,
  timeZone,
  options: { showLabels, showTime, wrapLogMessage, sortOrder, dedupStrategy, enableLogDetails },
  title,
}) => {
  const theme = useTheme2();
  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const spacing = css`
    margin-bottom: ${theme.spacing(1.5)};
    //We can remove this hot-fix when we fix panel menu with no title overflowing top of all panels
    margin-top: ${theme.spacing(!title ? 2.5 : 0)};
  `;

  const newResults = data ? dataFrameToLogsModel(data.series, data.request?.intervalMs) : null;
  const logRows = newResults?.rows || [];
  const deduplicatedRows = dedupLogRows(logRows, dedupStrategy);

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, range: data.timeRange });
  };

  return (
    <CustomScrollbar autoHide>
      <div className={spacing}>
        <LogRows
          logRows={logRows}
          deduplicatedRows={deduplicatedRows}
          dedupStrategy={dedupStrategy}
          highlighterExpressions={[]}
          showLabels={showLabels}
          showTime={showTime}
          wrapLogMessage={wrapLogMessage}
          timeZone={timeZone}
          getFieldLinks={getFieldLinks}
          logsSortOrder={sortOrder}
          enableLogDetails={enableLogDetails}
        />
      </div>
    </CustomScrollbar>
  );
};
