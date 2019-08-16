import React from 'react';
import { PanelProps, Logs } from '@grafana/ui';
import { Options } from './types';
import { AbsoluteTimeRange } from '@grafana/data';
import { dataFrameToLogsModel } from 'app/core/logs_model';
import { sortLogsResult } from 'app/core/utils/explore';
import { offOption } from '@grafana/ui/src/components/RefreshPicker/RefreshPicker';

interface LogsPanelProps extends PanelProps<Options> {}

export const LogsPanel: React.FunctionComponent<LogsPanelProps> = ({ data, timeRange, timeZone, options, width }) => {
  if (!data) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const absoluteRange: AbsoluteTimeRange = {
    from: timeRange.from.valueOf(),
    to: timeRange.to.valueOf(),
  };
  const newResults = data ? dataFrameToLogsModel(data.series, data.request.intervalMs) : null;
  const sortedNewResults = sortLogsResult(newResults, offOption.value);

  return (
    <>
      <Logs
        data={sortedNewResults}
        dedupedData={sortedNewResults}
        absoluteRange={absoluteRange}
        dedupStrategy={options.dedupStrategy}
        hiddenLogLevels={null}
        loading={false}
        onDedupStrategyChange={() => undefined}
        highlighterExpressions={[]}
        onChangeTime={() => undefined}
        onToggleLogLevel={() => undefined}
        timeZone={timeZone}
        width={width}
      />
    </>
  );
};
