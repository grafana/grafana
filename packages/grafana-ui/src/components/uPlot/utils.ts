import { DataFrame, dateTime, FieldType } from '@grafana/data';
import { AlignedData, Options } from 'uplot';
import { PlotPlugin, PlotProps } from './types';
import { StackingMode } from './config';
import { createLogger } from '../../utils/logger';
import { attachDebugger } from '../../utils';

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

export function preparePlotData(frame: DataFrame, ignoreFieldTypes?: FieldType[]): AlignedData {
  const result: any[] = [];
  const stackingGroups: Record<string, number[]> = {};

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

    if (f.config.custom?.stackingMode !== StackingMode.None && f.config.custom?.stackingGroup) {
      if (!stackingGroups[f.config.custom.stackingGroup]) {
        stackingGroups[f.config.custom.stackingGroup] = [result.length];
      } else {
        stackingGroups[f.config.custom.stackingGroup].push(result.length);
      }
    }
    result.push(f.values.toArray());
  }

  // Stacking
  if (Object.keys(stackingGroups).length !== 0) {
    // array or stacking groups
    const groups = Object.keys(stackingGroups);

    for (let i = 0; i < groups.length; i++) {
      // stacking group key
      const group = groups[i];
      // series indexes within results array
      const seriesIdxs = stackingGroups[group];

      const acc = Array(result[0].length).fill(0);
      for (let j = 0; j < seriesIdxs.length; j++) {
        const currentlyStacking = result[seriesIdxs[j]];
        for (let k = 0; k < result[0].length; k++) {
          const v = currentlyStacking[k];
          acc[k] += v === null || v === undefined ? 0 : +v;
        }
        result[seriesIdxs[j]] = acc.slice();
      }
    }
    return result as AlignedData;
  }
  return result as AlignedData;
}

// Dev helpers

/** @internal */
export const pluginLogger = createLogger('uPlot Plugin');
export const pluginLog = pluginLogger.logger;

attachDebugger('graphng', undefined, pluginLogger);
