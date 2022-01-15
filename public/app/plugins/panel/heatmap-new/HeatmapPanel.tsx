import React, { useMemo } from 'react';
import { Field, PanelProps } from '@grafana/data';
import { TimeSeries, useTheme2 } from '@grafana/ui';
import { ScaleProps } from '@grafana/ui/src/components/uPlot/config/UPlotScaleBuilder';
import { AxisProps } from '@grafana/ui/src/components/uPlot/config/UPlotAxisBuilder';
import { prepareHeatmapData } from './fields';
import { PanelDataErrorView } from '@grafana/runtime';
import { PanelOptions } from './models.gen';

interface HeatmapPanelProps extends PanelProps<PanelOptions> {}

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  data,
  id,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const theme = useTheme2();

  const info = useMemo(() => prepareHeatmapData(data?.series, options, theme), [data, options, theme]);

  const { renderers, tweakScale, tweakAxis } = useMemo(() => {
    let tweakScale = (opts: ScaleProps, forField: Field) => opts;
    let tweakAxis = (opts: AxisProps, forField: Field) => opts;

    let doNothing = {
      renderers: [],
      tweakScale,
      tweakAxis,
    };

    return doNothing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev]);

  if (info.warning || !info.heatmap) {
    return <PanelDataErrorView panelId={id} data={data} needsNumberField={true} message={info.warning} />;
  }

  return (
    <TimeSeries
      frames={[info.heatmap]}
      structureRev={data.structureRev}
      timeRange={timeRange}
      timeZone={timeZone}
      width={width}
      height={height}
      legend={options.legend}
      renderers={renderers}
      tweakAxis={tweakAxis}
      tweakScale={tweakScale}
      options={options}
    >
      {(config, alignedDataFrame) => {
        // todo... add standard items...
        return null;
      }}
    </TimeSeries>
  );
};
