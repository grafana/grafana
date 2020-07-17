import React from 'react';
import { MicroPlot } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Options } from './types';

interface GraphPanelProps extends PanelProps<Options> {}

export const GraphPanel: React.FunctionComponent<GraphPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onOptionsChange,
  onChangeTimeRange,
  replaceVariables,
}) => {
  if (!data || !data.series?.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <MicroPlot
      timeRange={timeRange}
      timeZone={timeZone}
      realTimeUpdates={options.graph.realTimeUpdates}
      width={width}
      height={height}
      data={data.series[0]}
      theme={config.theme}
    />
  );
};
