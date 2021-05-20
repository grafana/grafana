import React, { useCallback, useMemo } from 'react';
import { Button, GraphNGLegendEvent, TimeSeries, TooltipPlugin } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';
import { getXYDimensions } from './dims';

interface XYChartPanelProps extends PanelProps<Options> {}

export const XYChartPanel: React.FC<XYChartPanelProps> = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onFieldConfigChange,
}) => {
  const dims = useMemo(() => getXYDimensions(options.dims, data.series), [options.dims, data.series]);

  const frames = useMemo(() => [dims.frame], [dims]);

  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, frames));
    },
    [fieldConfig, onFieldConfigChange, frames]
  );

  if (dims.error) {
    return (
      <div>
        <div>ERROR: {dims.error}</div>
        {dims.hasData && (
          <div>
            <Button onClick={() => alert('TODO, switch vis')}>Show as Table</Button>
            {dims.hasTime && <Button onClick={() => alert('TODO, switch vis')}>Show as Time series</Button>}
          </div>
        )}
      </div>
    );
  }

  return (
    <TimeSeries
      frames={frames}
      structureRev={data.structureRev}
      fields={dims.fields}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onLegendClick={onLegendClick}
    >
      {(config, alignedDataFrame) => {
        return (
          <TooltipPlugin
            config={config}
            data={alignedDataFrame}
            mode={options.tooltip.mode as any}
            timeZone={timeZone}
          />
        );
      }}
    </TimeSeries>
  );
};
