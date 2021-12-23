import { DataFrame, ensureTimeField, Field, FieldType } from '@grafana/data';
import { StackingMode, VizLegendOptions } from '@grafana/schema';
import { orderBy } from 'lodash';
import uPlot, { AlignedData, Options, PaddingSide } from 'uplot';
import { attachDebugger } from '../../utils';
import { createLogger } from '../../utils/logger';

const ALLOWED_FORMAT_STRINGS_REGEX = /\b(YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW|HH|H|h|AA|aa|a|mm|m|ss|s|fff)\b/g;

export function timeFormatToTemplate(f: string) {
  return f.replace(ALLOWED_FORMAT_STRINGS_REGEX, (match) => `{${match}}`);
}

const paddingSide: PaddingSide = (u, side, sidesWithAxes) => {
  let hasCrossAxis = side % 2 ? sidesWithAxes[0] || sidesWithAxes[2] : sidesWithAxes[1] || sidesWithAxes[3];

  return sidesWithAxes[side] || !hasCrossAxis ? 0 : 8;
};

export const DEFAULT_PLOT_CONFIG: Partial<Options> = {
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
  padding: [paddingSide, paddingSide, paddingSide, paddingSide],
  series: [],
  hooks: {},
};

/** @internal */
interface StackMeta {
  totals: AlignedData;
}

/** @internal */
export function preparePlotData(
  frames: DataFrame[],
  onStackMeta?: (meta: StackMeta) => void,
  legend?: VizLegendOptions
): AlignedData {
  const frame = frames[0];
  const result: any[] = [];
  const stackingGroups: Map<string, number[]> = new Map();
  let seriesIndex = 0;

  for (let i = 0; i < frame.fields.length; i++) {
    const f = frame.fields[i];

    if (f.type === FieldType.time) {
      result.push(ensureTimeField(f).values.toArray());
      seriesIndex++;
      continue;
    }

    collectStackingGroups(f, stackingGroups, seriesIndex);
    result.push(f.values.toArray());
    seriesIndex++;
  }

  // Stacking
  if (stackingGroups.size !== 0) {
    const byPct = frame.fields[1].config.custom?.stacking?.mode === StackingMode.Percent;
    const dataLength = result[0].length;
    const alignedTotals = Array(stackingGroups.size);
    alignedTotals[0] = null;

    // array or stacking groups
    for (const [_, seriesIds] of stackingGroups.entries()) {
      const seriesIdxs = orderIdsByCalcs({ ids: seriesIds, legend, frame });

      const groupTotals = byPct ? Array(dataLength).fill(0) : null;

      if (byPct) {
        for (let j = 0; j < seriesIdxs.length; j++) {
          const currentlyStacking = result[seriesIdxs[j]];

          for (let k = 0; k < dataLength; k++) {
            const v = currentlyStacking[k];
            groupTotals![k] += v == null ? 0 : +v;
          }
        }
      }

      const acc = Array(dataLength).fill(0);

      for (let j = 0; j < seriesIdxs.length; j++) {
        let seriesIdx = seriesIdxs[j];

        alignedTotals[seriesIdx] = groupTotals;

        const currentlyStacking = result[seriesIdx];

        for (let k = 0; k < dataLength; k++) {
          const v = currentlyStacking[k];
          acc[k] += v == null ? 0 : v / (byPct ? groupTotals![k] : 1);
        }

        result[seriesIdx] = acc.slice();
      }
    }

    onStackMeta &&
      onStackMeta({
        totals: alignedTotals as AlignedData,
      });
  }

  return result as AlignedData;
}

export function collectStackingGroups(f: Field, groups: Map<string, number[]>, seriesIdx: number) {
  const customConfig = f.config.custom;
  if (!customConfig) {
    return;
  }
  if (
    customConfig.stacking?.mode !== StackingMode.None &&
    customConfig.stacking?.group &&
    !customConfig.hideFrom?.viz
  ) {
    if (!groups.has(customConfig.stacking.group)) {
      groups.set(customConfig.stacking.group, [seriesIdx]);
    } else {
      groups.set(customConfig.stacking.group, groups.get(customConfig.stacking.group)!.concat(seriesIdx));
    }
  }
}

/**
 * Finds y axis midpoint for point at given idx (css pixels relative to uPlot canvas)
 * @internal
 **/

export function findMidPointYPosition(u: uPlot, idx: number) {
  let y;
  let sMaxIdx = 1;
  let sMinIdx = 1;
  // assume min/max being values of 1st series
  let max = u.data[1][idx];
  let min = u.data[1][idx];

  // find min max values AND ids of the corresponding series to get the scales
  for (let i = 1; i < u.data.length; i++) {
    const sData = u.data[i];
    const sVal = sData[idx];
    if (sVal != null) {
      if (max == null) {
        max = sVal;
      } else {
        if (sVal > max) {
          max = u.data[i][idx];
          sMaxIdx = i;
        }
      }
      if (min == null) {
        min = sVal;
      } else {
        if (sVal < min) {
          min = u.data[i][idx];
          sMinIdx = i;
        }
      }
    }
  }

  if (min == null && max == null) {
    // no tooltip to show
    y = undefined;
  } else if (min != null && max != null) {
    // find median position
    y = (u.valToPos(min, u.series[sMinIdx].scale!) + u.valToPos(max, u.series[sMaxIdx].scale!)) / 2;
  } else {
    // snap tooltip to min OR max point, one of those is not null :)
    y = u.valToPos((min || max)!, u.series[(sMaxIdx || sMinIdx)!].scale!);
  }

  // if y is out of canvas bounds, snap it to the bottom
  if (y !== undefined && y < 0) {
    y = u.bbox.height / devicePixelRatio;
  }

  return y;
}

// Dev helpers

/** @internal */
export const pluginLogger = createLogger('uPlot');
export const pluginLog = pluginLogger.logger;
// pluginLogger.enable();
attachDebugger('graphng', undefined, pluginLogger);

type OrderIdsByCalcsOptions = {
  legend?: VizLegendOptions;
  ids: number[];
  frame: DataFrame;
};
export function orderIdsByCalcs({ legend, ids, frame }: OrderIdsByCalcsOptions) {
  if (!legend?.sortBy || legend.sortDesc == null) {
    return ids;
  }
  const orderedIds = orderBy<number>(
    ids,
    (id) => {
      return frame.fields[id].state?.calcs?.[legend.sortBy!.toLowerCase()];
    },
    legend.sortDesc ? 'desc' : 'asc'
  );

  return orderedIds;
}
