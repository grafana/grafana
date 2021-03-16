import React, { useCallback, useMemo } from 'react';
import { Button, TooltipPlugin, GraphNG, GraphNGLegendEvent } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { hideSeriesConfigFactory } from '../timeseries/overrides/hideSeriesConfigFactory';
import { getXYDimensions } from './dims';
import { changeSeriesColorConfigFactory } from '../timeseries/overrides/colorSeriesConfigFactory';

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

  const frames = useMemo(() => [dims.frame], [dims]);

  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, frames));
    },
    [fieldConfig, onFieldConfigChange, frames]
  );

  const onSeriesColorChange = useCallback(
    (label: string, color: string) => {
      onFieldConfigChange(changeSeriesColorConfigFactory(label, color, fieldConfig));
    },
    [fieldConfig, onFieldConfigChange]
  );

  return (
    <GraphNG
      data={frames}
      fields={dims.fields}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onLegendClick={onLegendClick}
      onSeriesColorChange={onSeriesColorChange}
    >
      <TooltipPlugin data={data.series} mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
      <>{/* needs to be an array */}</>
    </GraphNG>
  );
};
