import React, { useMemo } from 'react';

import { PanelProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { PlotCanvas } from './components/PlotCanvas';
import { ScatterPlotOptions } from './models.gen';
import { preparePlotByDims, preparePlotByExplicitSeries } from './utils';

interface Props extends PanelProps<ScatterPlotOptions> {}

export const ScatterPlotPanel = (props: Props) => {
  const theme = useTheme2();
  const frames = useMemo(() => {
    if (props.options.seriesMapping === 'manual') {
      return preparePlotByExplicitSeries(props.data.series, props.options.series!);
    } else {
      return preparePlotByDims(props.data.series, props.options.dims!);
    }
  }, [props.data.series, props.options.series, props.options.dims, props.options.seriesMapping]);

  const options: ScatterPlotOptions = props.options;
  options.themeColor = theme.isDark ? '#ffffff' : '#000000';
  options.hudBgColor = theme.colors.background.secondary;

  let error = false;
  for (const frame of frames) {
    if (frame.fields.length < 3) {
      error = true;
      break;
    }
  }

  if (error || frames.length === 0) {
    return (
      <div className="panel-empty">
        <p>Incorrect data</p>
      </div>
    );
  }

  return <PlotCanvas frames={frames} options={options} />;
};
