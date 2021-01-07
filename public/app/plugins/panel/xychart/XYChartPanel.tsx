import React, { useCallback, useMemo } from 'react';
import { TooltipPlugin, GraphNG, GraphNGLegendEvent } from '@grafana/ui';
import { PanelProps } from '@grafana/data';
import { Options } from './types';
import { hideSeriesConfigFactory } from '../graph3/hideSeriesConfigFactory';
import { configToXYFieldMatchers } from './dims';

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
  const fields = useMemo(() => configToXYFieldMatchers(options.graph), [options]);

  const frame = useMemo(() => {
    if (!data.series?.length) {
      return [];
    }
    const idx = options.graph?.dims?.frame ?? 0;
    console.log('IDX', idx, data.series);
    return [data.series[idx]];
  }, [data.series, options.graph]);

  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      onFieldConfigChange(hideSeriesConfigFactory(event, fieldConfig, frame));
    },
    [fieldConfig, onFieldConfigChange, frame]
  );

  return (
    <GraphNG
      data={frame}
      fields={fields}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      onLegendClick={onLegendClick}
    >
      <TooltipPlugin mode={options.tooltipOptions.mode as any} timeZone={timeZone} />
      <>{/* needs an array? */}</>
    </GraphNG>
  );
};
