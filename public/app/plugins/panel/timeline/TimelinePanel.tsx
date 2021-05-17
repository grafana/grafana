import React from 'react';
import { PanelProps } from '@grafana/data';
import { useTheme2, ZoomPlugin } from '@grafana/ui';
import { TimelineOptions } from './types';
import { TimelineChart } from './TimelineChart';

interface TimelinePanelProps extends PanelProps<TimelineOptions> {}

/**
 * @alpha
 */
export const TimelinePanel: React.FC<TimelinePanelProps> = ({
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
    >
      {(config) => <ZoomPlugin config={config} onZoom={onChangeTimeRange} />}
    </TimelineChart>
  );
};
