import React, { useMemo } from 'react';
import { PanelProps } from '@grafana/data';
import { useTheme2, ZoomPlugin } from '@grafana/ui';
import { TimelineMode, TimelineOptions } from './types';
import { TimelineChart } from './TimelineChart';
import { prepareTimelineFields } from './utils';

interface TimelinePanelProps extends PanelProps<TimelineOptions> {}

/**
 * @alpha
 */
export const StateTimelinePanel: React.FC<TimelinePanelProps> = ({
  data,
  timeRange,
  timeZone,
  options,
  width,
  height,
  onChangeTimeRange,
}) => {
  const theme = useTheme2();

  const { frames, warn } = useMemo(() => prepareTimelineFields(data?.series, options.mergeValues ?? true), [
    data,
    options.mergeValues,
  ]);

  if (!frames || warn) {
    return (
      <div className="panel-empty">
        <p>{warn ?? 'No data found in response'}</p>
      </div>
    );
  }

  return (
    <TimelineChart
      theme={theme}
      frames={frames}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      {...options}
      // hardcoded
      mode={TimelineMode.Changes}
    >
      {(config) => <ZoomPlugin config={config} onZoom={onChangeTimeRange} />}
    </TimelineChart>
  );
};
