import React from 'react';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { GraphView } from '@grafana/ui/src/components/ServiceMap/GraphView';

export const ServiceMapPanel: React.FunctionComponent<PanelProps<Options>> = ({
  width,
  height,
  data,
  timeZone,
  options,
}) => {
  if (!data || !data.series.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  const serviceMapFrames = data.series.filter(frame => frame.meta?.preferredVisualisationType === 'serviceMap');
  const finalFrame = serviceMapFrames.length ? serviceMapFrames[0] : data.series[0];

  return (
    <div style={{ width, height }}>
      <GraphView services={finalFrame.fields[0].values.toArray()} />
    </div>
  );
};
