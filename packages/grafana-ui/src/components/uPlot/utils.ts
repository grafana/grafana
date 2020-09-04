import throttle from 'lodash/throttle';
import { DataFrame, FieldType, getFieldDisplayName, getTimeField, GrafanaTheme, TimeRange } from '@grafana/data';
import { rangeToMinMax } from './MicroPlot';
import { colors } from '../../utils';
import uPlot from 'uplot';
import { PlotProps } from './types';

// based on aligned data frames creates config for scales, axes and series
export const buildSeriesConfig = (
  data: DataFrame,
  timeRange: TimeRange,
  theme: GrafanaTheme
): {
  series: uPlot.Series[];
  scales: Record<string, uPlot.Scale>;
  axes: uPlot.Axis[];
} => {
  console.log('buildSeriesConfig', data);
  const series: uPlot.Series[] = [{}];
  const scales: Record<string, uPlot.Scale> = {
    x: {
      time: true,
      range: rangeToMinMax(timeRange.raw),
    },
  };

  const axes: uPlot.Axis[] = [];

  let { timeIndex } = getTimeField(data);

  if (timeIndex === undefined) {
    timeIndex = 0; // assuming first field represents x-domain
    scales.x.time = false;
  }

  // x-axis
  axes.push({
    show: true,
    stroke: theme.colors.text,
    grid: {
      show: true,
      stroke: theme.palette.gray1,
      width: 1 / devicePixelRatio,
    },
  });

  let seriesIdx = 0;

  for (let i = 0; i < data.fields.length; i++) {
    const field = data.fields[i];

    // TODO
    // const fmt = field.display ?? defaultFormatter;

    if (i === timeIndex || field.type !== FieldType.number) {
      continue;
    }

    const scale = field.config.unit || '__fixed';

    if (!scales[scale]) {
      scales[scale] = {};
      axes.push({
        scale,
        show: true,
        size: 80,
        stroke: theme.colors.text,
        side: 3,
        grid: {
          show: true,
          stroke: theme.palette.gray1, // X grid lines
          width: 1 / devicePixelRatio,
        },
        // values: (u, vals, space) => vals.map(v => formattedValueToString(fmt(v))),
      });
    }

    series.push({
      scale,
      label: getFieldDisplayName(field, data),
      stroke: colors[seriesIdx],
      width: 1,
      points: {
        show: false,
        size: 20,
      },
    });
    seriesIdx += 1;
  }

  return {
    scales,
    series,
    axes,
  };
};

export const buildPlotConfig = (props: PlotProps, data: DataFrame, theme: GrafanaTheme): uPlot.Options => {
  const seriesConfig = buildSeriesConfig(data, props.timeRange, theme);

  return {
    width: props.width,
    height: props.height,
    focus: {
      alpha: 1,
    },
    cursor: {
      focus: {
        prox: 30,
      },
    },
    legend: {
      show: false,
    },
    plugins: [],
    hooks: {},
    ...seriesConfig,
  };
};

export const preparePlotData = (data: DataFrame): uPlot.AlignedData => {
  const plotData: any[] = [];

  // Prepare x axis
  let { timeIndex } = getTimeField(data);
  let xvals = data.fields[timeIndex!].values.toArray();

  if (!isNaN(timeIndex!)) {
    xvals = xvals.map(v => v / 1000);
  }

  plotData.push(xvals);

  for (let i = 0; i < data.fields.length; i++) {
    const field = data.fields[i];

    // already handled time and we ignore non-numeric fields
    if (i === timeIndex || field.type !== FieldType.number) {
      continue;
    }

    plotData.push(field.values.toArray());
  }

  console.log('Prepared Data:', plotData);
  return plotData;
};

// Dev helpers
export const throttledLog = throttle((...t: any[]) => {
  console.log(...t);
}, 500);

export const pluginLog = throttle((id: string, throttle = false, ...t: any[]) => {
  const fn = throttle ? throttledLog : console.log;
  fn(`[Plugin: ${id}]: `, ...t);
}, 500);
