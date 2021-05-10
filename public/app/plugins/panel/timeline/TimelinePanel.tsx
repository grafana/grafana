import React, { useCallback } from 'react';
import { PanelProps } from '@grafana/data';
import { GraphNGLegendEvent, useTheme2 } from '@grafana/ui';
import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';
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
  fieldConfig,
  onFieldConfigChange,
}) => {
  const theme = useTheme2();

  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, data.series));
    },
    [fieldConfig, onFieldConfigChange, data.series]
  );

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
      onLegendClick={onLegendClick}
      {...options}
    />
  );
};
