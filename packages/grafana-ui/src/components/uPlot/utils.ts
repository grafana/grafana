import { DataFrame, ensureTimeField, Field, FieldType } from '@grafana/data';
import { GraphDrawStyle, GraphFieldConfig, GraphTransform, StackingMode, VizLegendOptions } from '@grafana/schema';
import { orderBy } from 'lodash';
import uPlot, { AlignedData, Options, PaddingSide } from 'uplot';
import { attachDebugger } from '../../utils';
import { createLogger } from '../../utils/logger';
import { buildScaleKey } from '../GraphNG/utils';

const ALLOWED_FORMAT_STRINGS_REGEX = /\b(YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW|HH|H|h|AA|aa|a|mm|m|ss|s|fff)\b/g;
export const INTERNAL_NEGATIVE_Y_PREFIX = '__internalNegY';

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
  for (let i = 0; i < frame.fields.length; i++) {
    const f = frame.fields[i];

    if (f.type === FieldType.time) {
      result.push(ensureTimeField(f).values.toArray());
      continue;
    }

    collectStackingGroups(f, stackingGroups, i);
    const customConfig: GraphFieldConfig = f.config.custom || {};

    const values = f.values.toArray();

    if (customConfig.transform === GraphTransform.NegativeY) {
      result.push(values.map((v) => (v == null ? v : v * -1)));
    } else if (customConfig.transform === GraphTransform.Constant) {
      result.push(new Array(values.length).fill(values[0]));
    } else {
      result.push(values);
    }
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
      const noValueStack = Array(dataLength).fill(true);
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
          if (v != null && noValueStack[k]) {
            noValueStack[k] = false;
          }
          acc[k] += v == null ? 0 : v / (byPct ? groupTotals![k] : 1);
        }

        result[seriesIdx] = acc.slice().map((v, i) => (noValueStack[i] ? null : v));
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
    const group =
      customConfig.transform === GraphTransform.NegativeY
        ? `${INTERNAL_NEGATIVE_Y_PREFIX}-${customConfig.stacking.group}`
        : customConfig.stacking.group;

    if (!groups.has(group)) {
      groups.set(group, [seriesIdx]);
    } else {
      groups.set(group, groups.get(group)!.concat(seriesIdx));
    }
  }
}

export interface StackingGroup {
  series: number[];
  dir: number;
}

// generates bands between adjacent group series
export function getStackingBands(group: StackingGroup) {
  let bands: uPlot.Band[] = [];
  let { series, dir } = group;
  let lastIdx = series.length - 1;

  let rSeries = series.slice().reverse();

  rSeries.forEach((si, i) => {
    if (i !== lastIdx) {
      let nextIdx = rSeries[i + 1];
      bands.push({
        series: [si, nextIdx],
        // fill direction is inverted from stack direction
        dir: -1 * dir,
      });
    }
  });

  return bands;
}

// expects an AlignedFrame
export function getStackingGroups(frame: DataFrame) {
  let groups: Map<string, StackingGroup> = new Map();

  frame.fields.forEach(({ config, values }, i) => {
    // skip x or time field
    if (i === 0) {
      return;
    }

    let { custom } = config;

    if (custom == null) {
      return;
    }

    // TODO: currently all AlignedFrame fields end up in uplot series & data, even custom.hideFrom?.viz
    // ideally hideFrom.viz fields would be excluded so we can remove this
    if (custom.hideFrom?.viz) {
      return;
    }

    let { mode: stackingMode, group: stackingGroup } = custom.stacking;

    // not stacking
    if (stackingMode === StackingMode.None) {
      return;
    }

    // will this be stacked up or down after any transforms applied
    let vals = values.toArray();
    let transform = custom.transform;
    let stackDir =
      transform === GraphTransform.Constant
        ? vals[0] > 0
          ? 1
          : -1
        : transform === GraphTransform.NegativeY
        ? vals.some((v) => v > 0)
          ? -1
          : 1
        : vals.some((v) => v > 0)
        ? 1
        : -1;

    let drawStyle = custom.drawStyle;
    let drawStyle2 =
      drawStyle === GraphDrawStyle.Bars
        ? custom.barAlignment
        : drawStyle === GraphDrawStyle.Line
        ? custom.lineInterpolation
        : '';

    let stackKey = [stackDir, stackingMode, stackingGroup, buildScaleKey(config), drawStyle, drawStyle2].join('|');

    let group = groups.get(stackKey);

    if (group == null) {
      group = {
        series: [],
        dir: stackDir,
      };

      groups.set(stackKey, group);
    }

    group.series.push(i);
  });

  console.log(...groups.values());

  return [...groups.values()];
}

/** @internal */
export function preparePlotData2(
  frame: DataFrame,
  stackingGroups: StackingGroup[],
  onStackMeta?: (meta: StackMeta) => void
) {
  let data: AlignedData = Array(frame.fields.length);

  let dataLen = frame.length;
  let zeroArr = Array(dataLen).fill(0);
  let accums = Array.from({ length: stackingGroups.length }, () => zeroArr.slice());

  frame.fields.forEach((field, i) => {
    if (i === 0) {
      if (field.type === FieldType.time) {
        data[i] = ensureTimeField(field).values.toArray();
      }
      return;
    }

    let vals = field.values.toArray();

    let { custom } = field.config;

    if (!custom) {
      return;
    }

    // apply transforms
    if (custom.transform === GraphTransform.Constant) {
      vals = Array(vals.length).fill(vals[0]);
    } else {
      vals = vals.slice();

      if (custom.transform === GraphTransform.NegativeY) {
        for (let i = 0; i < vals.length; i++) {
          if (vals[i] != null) {
            vals[i] *= -1;
          }
        }
      }
    }

    if (custom.stacking.mode === StackingMode.None) {
      data[i] = vals;
    } else {
      let stackIdx = stackingGroups.findIndex((group) => group.series.indexOf(i) > -1);
      let accum = accums[stackIdx];
      let stacked = (data[i] = Array(dataLen));

      for (let i = 0; i < dataLen; i++) {
        let v = vals[i];

        if (v != null) {
          stacked[i] = accum[i] += v;
        } else {
          stacked[i] = v; // we may want to coerce to 0 here
        }
      }
    }
  });

  // re-compute by percent
  frame.fields.forEach((field, i) => {
    if (i === 0) {
      return;
    }

    if (field.config.custom?.stacking.mode === StackingMode.Percent) {
      let stackIdx = stackingGroups.findIndex((group) => group.series.indexOf(i) > -1);
      let accum = accums[stackIdx];
      let group = stackingGroups[stackIdx];

      let stacked = data[i];

      for (let i = 0; i < dataLen; i++) {
        let v = stacked[i];

        if (v != null) {
          // v / accum will always be pos, so properly (re)sign by group stacking dir
          stacked[i] = group.dir * (v / accum[i]);
        }
      }
    }
  });

  return data;
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
