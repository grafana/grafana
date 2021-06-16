import React from 'react';
import { PanelProps } from '@grafana/data';
import { useTheme2, ZoomPlugin } from '@grafana/ui';
import { StatusPanelOptions } from './types';
import { TimelineChart } from '../state-timeline/TimelineChart';
import { TimelineMode } from '../state-timeline/types';

interface TimelinePanelProps extends PanelProps<StatusPanelOptions> {}

/**
 * @alpha
 */
export const StatusGridPanel: React.FC<TimelinePanelProps> = ({
  data,
  timeRange,
  timeZone,
  options,
  width,
  height,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();

  if (!data || !data.series?.length) {
    return (
      <div className="panel-empty">
        <p>No data found in response</p>
      </div>
    );
  }

  return (
    <TimelineChart
      theme={theme}
      frames={data.series}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      {...options}
      // hardcoded
      mode={TimelineMode.Samples}
    >
      {(config) => <ZoomPlugin config={config} onZoom={onChangeTimeRange} />}
    </TimelineChart>
  );
};
