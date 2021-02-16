import { DataFrame, dateTime, FieldType } from '@grafana/data';
import throttle from 'lodash/throttle';
import { AlignedData, Options } from 'uplot';
import { PlotPlugin, PlotProps } from './types';
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

/** @internal */
export function preparePlotData(frame: DataFrame, stacking = StackingMode.None): AlignedData {
  const data = frame.fields.map((f) => {
    if (f.type === FieldType.time) {
      if (f.values.length > 0 && typeof f.values.get(0) === 'string') {
        const timestamps = [];
        for (let i = 0; i < f.values.length; i++) {
          timestamps.push(dateTime(f.values.get(i)).valueOf());
        }
        return timestamps;
      }
      return f.values.toArray();
    }

    return f.values.toArray();
  }) as AlignedData;

  if (stacking === StackingMode.None) {
    return data;
  }

  // TODO: percent stacking
  const acc = Array(data[0].length).fill(0);
  const result = [];

  for (let i = 1; i < data.length; i++) {
    for (let j = 0; j < data[i].length; j++) {
      const v = data[i][j];
      acc[j] += v === null || v === undefined ? 0 : +v;
    }
    result.push([...acc]);
  }

  return [data[0]].concat(result) as AlignedData;
}

// Dev helpers

/** @internal */
export const throttledLog = throttle((...t: any[]) => {
  console.log(...t);
}, 500);

/** @internal */
export function pluginLog(id: string, throttle = false, ...t: any[]) {
  if (process.env.NODE_ENV === 'production' || !LOGGING_ENABLED) {
    return;
  }
  const fn = throttle ? throttledLog : console.log;
  fn(`[Plugin: ${id}]: `, ...t);
}
