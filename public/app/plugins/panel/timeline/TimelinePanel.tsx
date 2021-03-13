import React, { useCallback, useMemo } from 'react';
import { FieldType, PanelProps, VizOrientation } from '@grafana/data';
import { Timeline, TimelineOptions, GraphNGLegendEvent } from '@grafana/ui';
import { changeSeriesColorConfigFactory } from '../timeseries/overrides/colorSeriesConfigFactory';
import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';
import { Options } from './types';

interface TimelinePanelProps extends PanelProps<Options> {}

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

  const firstFrame = data.series[0];

  if (!firstFrame.fields.some((f) => f.type === FieldType.string)) {
    return (
      <div className="panel-empty">
        <p>Bar charts requires a string field</p>
      </div>
    );
  }

  if (!firstFrame.fields.some((f) => f.type === FieldType.number)) {
    return (
      <div className="panel-empty">
        <p>No numeric fields found</p>
      </div>
    );
  }

  return (
    <Timeline
      data={data.series}
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
