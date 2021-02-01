import throttle from 'lodash/throttle';
import { AlignedData, Options } from 'uplot';
import { PlotPlugin, PlotProps } from './types';
import { DataFrame } from '@grafana/data';
import { StackingMode } from './config';

const LOGGING_ENABLED = true;
const ALLOWED_FORMAT_STRINGS_REGEX = /\b(YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW|HH|H|h|AA|aa|a|mm|m|ss|s|fff)\b/g;

export function timeFormatToTemplate(f: string) {
  return f.replace(ALLOWED_FORMAT_STRINGS_REGEX, (match) => `{${match}}`);
}

export function buildPlotConfig(props: PlotProps, plugins: Record<string, PlotPlugin>): Options {
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
    plugins: Object.entries(plugins).map((p) => ({
      hooks: p[1].hooks,
    })),
    hooks: {},
  } as Options;
}

export function isPlottingTime(config: Options) {
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
}

// Dev helpers
export const throttledLog = throttle((...t: any[]) => {
  console.log(...t);
}, 500);

export function pluginLog(id: string, throttle = false, ...t: any[]) {
  if (process.env.NODE_ENV === 'production' || !LOGGING_ENABLED) {
    return;
  }
  const fn = throttle ? throttledLog : console.log;
  fn(`[Plugin: ${id}]: `, ...t);
}

export function preparePlotData(frame: DataFrame, stacking = StackingMode.None): AlignedData {
  if (stacking === StackingMode.None) {
    return frame.fields.map((f) => f.values.toArray()) as AlignedData;
  }

  // TODO: percent stacking
  const acc = Array(frame.fields[0].values.length).fill(0);
  const result = [];
  for (let i = 1; i < frame.fields.length; i++) {
    for (let j = 0; j < frame.fields[i].values.length; j++) {
      const v = frame.fields[i].values.get(j);
      acc[j] += v === null || v === undefined ? 0 : +v;
    }
    result.push([...acc]);
  }
  return [frame.fields[0].values.toArray()].concat(result) as AlignedData;
}
