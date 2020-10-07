import throttle from 'lodash/throttle';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import { DataFrame, FieldType, getTimeField, rangeUtil, RawTimeRange } from '@grafana/data';
import uPlot from 'uplot';
import { PlotPlugin, PlotProps } from './types';

const ALLOWED_FORMAT_STRINGS_REGEX = /\b(YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW|HH|H|h|AA|aa|a|mm|m|ss|s|fff)\b/g;

export const timeFormatToTemplate = (f: string) => {
  return f.replace(ALLOWED_FORMAT_STRINGS_REGEX, match => `{${match}}`);
};

export function rangeToMinMax(timeRange: RawTimeRange): [number, number] {
  const v = rangeUtil.convertRawToRange(timeRange);
  return [v.from.valueOf() / 1000, v.to.valueOf() / 1000];
}

export const buildPlotConfig = (props: PlotProps, plugins: Record<string, PlotPlugin>): uPlot.Options => {
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
    plugins: Object.entries(plugins).map(p => ({
      hooks: p[1].hooks,
    })),
    hooks: {},
  } as any;
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

    let values = field.values.toArray();

    if (field.config.custom?.nullValues === 'asZero') {
      values = values.map(v => (v === null ? 0 : v));
    }

    plotData.push(values);
  }

  return plotData;
};

const isPlottingTime = (config: uPlot.Options) => {
  let isTimeSeries = false;

  if (!config.scales) {
    return false;
  }

  for (let i = 0; i < Object.keys(config.scales).length; i++) {
    const key = Object.keys(config.scales)[i];
    if (config.scales[key].time === true) {
      isTimeSeries = true;
      break;
    }
  }

  return isTimeSeries;
};

/**
 * Based on two config objects indicates whether or not uPlot needs reinitialisation
 * This COULD be done based on data frames, but keeping it this way for now as a simplification
 */
export const shouldReinitialisePlot = (prevConfig?: uPlot.Options, config?: uPlot.Options) => {
  if (!config && !prevConfig) {
    return false;
  }

  if (!prevConfig && config) {
    if (config.width === 0 || config.height === 0) {
      return false;
    }
    return true;
  }

  if (isPlottingTime(config!) && prevConfig!.tzDate !== config!.tzDate) {
    return true;
  }
  // reinitialise when number of series, scales or axes changes
  if (
    prevConfig!.series?.length !== config!.series?.length ||
    prevConfig!.axes?.length !== config!.axes?.length ||
    prevConfig!.scales?.length !== config!.scales?.length
  ) {
    return true;
  }

  let idx = 0;

  // reinitialise when any of the series config changes
  if (config!.series && prevConfig!.series) {
    for (const series of config!.series) {
      if (!isEqual(series, prevConfig!.series[idx])) {
        return true;
      }
      idx++;
    }
  }

  if (config!.axes && prevConfig!.axes) {
    idx = 0;
    for (const axis of config!.axes) {
      // Comparing axes config, skipping values property as it changes across config builds - probably need to be more clever
      if (!isEqual(omit(axis, 'values'), omit(prevConfig!.axes[idx], 'values'))) {
        return true;
      }
      idx++;
    }
  }

  return false;
};

// Dev helpers
export const throttledLog = throttle((...t: any[]) => {
  console.log(...t);
}, 500);

export const pluginLog = (id: string, throttle = false, ...t: any[]) => {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  const fn = throttle ? throttledLog : console.log;
  fn(`[Plugin: ${id}]: `, ...t);
};
