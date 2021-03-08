import { DataFrame, dateTime, FieldType } from '@grafana/data';
import throttle from 'lodash/throttle';
import { AlignedData, Options } from 'uplot';
import { PlotPlugin, PlotProps } from './types';

const LOGGING_ENABLED = false;
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
export function preparePlotData(frame: DataFrame): AlignedData {
  return frame.fields.map((f) => {
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
