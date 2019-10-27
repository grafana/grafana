import React from 'react';
import { PanelProps, LogRows, CustomScrollbar } from '@grafana/ui';
import { Options } from './types';
import { LogsDedupStrategy } from '@grafana/data';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { sortLogsResult } from 'app/core/utils/explore';
import { getLinksFromDataSource } from '../../../features/panel/panellinks/link_srv';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel: React.FunctionComponent<LogsPanelProps> = ({
  data,
  timeZone,
  options: { showTime, sortOrder },
  datasource,
}) => {
  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const newResults = data ? dataFrameToLogsModel(data.series, data.request.intervalMs) : null;
  const sortedNewResults = sortLogsResult(newResults, sortOrder);

  return (
    <CustomScrollbar autoHide>
      <LogRows
        data={sortedNewResults}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showTime={showTime}
        showLabels={false}
        timeZone={timeZone}
        getDerivedFields={(rowData: Record<string, any>) => getLinksFromDataSource(datasource, rowData)}
      />
    </CustomScrollbar>
  );
};
