import React, { useCallback } from 'react';
import { PanelProps } from '@grafana/data';
import { GraphNGLegendEvent, TimelineChart, TimelineOptions } from '@grafana/ui';
import { changeSeriesColorConfigFactory } from '../timeseries/overrides/colorSeriesConfigFactory';
import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';

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
  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, data.series));
    },
    [fieldConfig, onFieldConfigChange, data.series]
  );

  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
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
      data={data.series}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      onLegendClick={onLegendClick}
      onSeriesColorChange={onSeriesColorChange}
      {...options}
    />
  );
};
