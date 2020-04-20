import React from 'react';
import { LogRows, CustomScrollbar } from '@grafana/ui';
import { LogRowModel, LogsDedupStrategy, PanelProps } from '@grafana/data';
import { Options } from './types';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { sortLogsResult } from 'app/core/utils/explore';
import { appEvents } from '../../../core/core';
import { CoreEvents } from '../../../types';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel: React.FunctionComponent<LogsPanelProps> = ({
  id,
  data,
  timeRange,
  timeZone,
  options: { showLabels, showTime, wrapLogMessage, sortOrder },
  width,
}) => {
  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const newResults = data ? dataFrameToLogsModel(data.series, data.request?.intervalMs, timeZone) : null;
  const sortedNewResults = sortLogsResult(newResults, sortOrder);

  return (
    <CustomScrollbar autoHide>
      <LogRows
        logRows={sortedNewResults.rows}
        dedupStrategy={LogsDedupStrategy.none}
        highlighterExpressions={[]}
        showLabels={showLabels}
        showTime={showTime}
        wrapLogMessage={wrapLogMessage}
        timeZone={timeZone}
        allowDetails={true}
        onRowMouseEnter={(row: LogRowModel) => {
          appEvents.emit(CoreEvents.graphHover, {
            pos: { x: row.timeEpochMs, x1: row.timeEpochMs, y: 0, y1: 0, panelRelY: 0.5, pageY: 0, pageX: 0 },
            panel: { id },
          });
        }}
        onRowMouseLeave={() => {
          appEvents.emit(CoreEvents.graphHoverClear);
        }}
      />
    </CustomScrollbar>
  );
};
