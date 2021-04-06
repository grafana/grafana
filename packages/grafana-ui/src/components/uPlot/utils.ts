import { DataFrame, dateTime, FieldType } from '@grafana/data';
import { AlignedData, Options } from 'uplot';
import { PlotPlugin, PlotProps } from './types';
import { StackingMode } from './config';
import { createLogger } from '../../utils/logger';

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

export function preparePlotData(
  frame: DataFrame,
  ignoreFieldTypes?: FieldType[],
  stacking = StackingMode.None
): AlignedData {
  const result: any[] = [];

  for (let i = 0; i < frame.fields.length; i++) {
    const f = frame.fields[i];

    if (f.type === FieldType.time) {
      if (f.values.length > 0 && typeof f.values.get(0) === 'string') {
        const timestamps = [];
        for (let i = 0; i < f.values.length; i++) {
          timestamps.push(dateTime(f.values.get(i)).valueOf());
        }
        result.push(timestamps);
        continue;
      }
      result.push(f.values.toArray());
      continue;
    }
    if (ignoreFieldTypes && ignoreFieldTypes.indexOf(f.type) > -1) {
      continue;
    }
    result.push(f.values.toArray());
  }

  if (stacking === StackingMode.None) {
    return result as AlignedData;
  }

  // TODO: percent stacking
  const acc = Array(result[0].length).fill(0);
  const stacked = [];

  for (let i = 1; i < result.length; i++) {
    for (let j = 0; j < result[i].length; j++) {
      const v = result[i][j];
      acc[j] += v === null || v === undefined ? 0 : +v;
    }
    stacked.push([...acc]);
  }

  return [result[0]].concat(result) as AlignedData;
}

// Dev helpers

/** @internal */
export const pluginLog = createLogger('uPlot Plugin', LOGGING_ENABLED);
