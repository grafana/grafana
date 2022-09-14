import uPlot, { AlignedData, Options, PaddingSide } from 'uplot';

import { DataFrame, ensureTimeField, FieldType } from '@grafana/data';
import { BarAlignment, GraphDrawStyle, GraphTransform, LineInterpolation, StackingMode } from '@grafana/schema';

import { attachDebugger } from '../../utils';
import { createLogger } from '../../utils/logger';
import { buildScaleKey } from '../GraphNG/utils';

const ALLOWED_FORMAT_STRINGS_REGEX = /\b(YYYY|YY|MMMM|MMM|MM|M|DD|D|WWWW|WWW|HH|H|h|AA|aa|a|mm|m|ss|s|fff)\b/g;

export function timeFormatToTemplate(f: string) {
  return f.replace(ALLOWED_FORMAT_STRINGS_REGEX, (match) => `{${match}}`);
}

const paddingSide: PaddingSide = (u, side, sidesWithAxes) => {
  let hasCrossAxis = side % 2 ? sidesWithAxes[0] || sidesWithAxes[2] : sidesWithAxes[1] || sidesWithAxes[3];

  return sidesWithAxes[side] || !hasCrossAxis ? 0 : 8;
};

export const DEFAULT_PLOT_CONFIG: Partial<Options> = {
  ms: 1,
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
export interface StackingGroup {
  series: number[];
  dir: StackDirection;
}

/** @internal */
const enum StackDirection {
  Pos = 1,
  Neg = -1,
}

// generates bands between adjacent group series
/** @internal */
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
        dir: (-1 * dir) as 1 | -1,
      });
    }
  });

  return bands;
}

// expects an AlignedFrame
/** @internal */
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

    let { stacking } = custom;

    if (stacking == null) {
      return;
    }

    let { mode: stackingMode, group: stackingGroup } = stacking;

    // not stacking
    if (stackingMode === StackingMode.None) {
      return;
    }

    // will this be stacked up or down after any transforms applied
    let vals = values.toArray();
    let transform = custom.transform;
    let firstValue = vals.find((v) => v != null);
    let stackDir =
      transform === GraphTransform.Constant
        ? firstValue >= 0
          ? StackDirection.Pos
          : StackDirection.Neg
        : transform === GraphTransform.NegativeY
        ? firstValue >= 0
          ? StackDirection.Neg
          : StackDirection.Pos
        : firstValue >= 0
        ? StackDirection.Pos
        : StackDirection.Neg;

    let drawStyle = custom.drawStyle as GraphDrawStyle;
    let drawStyle2 =
      drawStyle === GraphDrawStyle.Bars
        ? (custom.barAlignment as BarAlignment)
        : drawStyle === GraphDrawStyle.Line
        ? (custom.lineInterpolation as LineInterpolation)
        : null;

    let stackKey = `${stackDir}|${stackingMode}|${stackingGroup}|${buildScaleKey(config)}|${drawStyle}|${drawStyle2}`;

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

  return [...groups.values()];
}

/** @internal */
export function preparePlotData2(
  frame: DataFrame,
  stackingGroups: StackingGroup[],
  onStackMeta?: (meta: StackMeta) => void
) {
  let data = Array(frame.fields.length) as AlignedData;

  let stacksQty = stackingGroups.length;

  let dataLen = frame.length;
  let zeroArr = stacksQty > 0 ? Array(dataLen).fill(0) : [];
  let falseArr = stacksQty > 0 ? Array(dataLen).fill(false) : [];
  let accums = Array.from({ length: stacksQty }, () => zeroArr.slice());

  let anyValsAtX = Array.from({ length: stacksQty }, () => falseArr.slice());

  // figure out at which time indices each stacking group has any values
  // (needed to avoid absorbing initial accum 0s at unrelated joined timestamps)
  stackingGroups.forEach((group, groupIdx) => {
    let groupValsAtX = anyValsAtX[groupIdx];

    group.series.forEach((seriesIdx) => {
      let field = frame.fields[seriesIdx];

      if (field.config.custom?.hideFrom?.viz) {
        return;
      }

      let vals = field.values.toArray();

      for (let i = 0; i < dataLen; i++) {
        if (vals[i] != null) {
          groupValsAtX[i] = true;
        }
      }
    });
  });

  frame.fields.forEach((field, i) => {
    let vals = field.values.toArray();

    if (i === 0) {
      if (field.type === FieldType.time) {
        data[i] = ensureTimeField(field).values.toArray();
      } else {
        data[i] = vals;
      }
      return;
    }

    let { custom } = field.config;

    if (!custom || custom.hideFrom?.viz) {
      data[i] = vals;
      return;
    }

    // apply transforms
    if (custom.transform === GraphTransform.Constant) {
      let firstValIdx = vals.findIndex((v) => v != null);
      let firstVal = vals[firstValIdx];
      vals = Array(vals.length).fill(undefined);
      vals[firstValIdx] = firstVal;
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

    let stackingMode = custom.stacking?.mode;

    if (!stackingMode || stackingMode === StackingMode.None) {
      data[i] = vals;
    } else {
      let stackIdx = stackingGroups.findIndex((group) => group.series.indexOf(i) > -1);

      let accum = accums[stackIdx];
      let groupValsAtX = anyValsAtX[stackIdx];
      let stacked = (data[i] = Array(dataLen));

      for (let i = 0; i < dataLen; i++) {
        let v = vals[i];

        if (v != null) {
          stacked[i] = accum[i] += v;
        } else {
          stacked[i] = groupValsAtX[i] ? accum[i] : v;
        }
      }
    }
  });

  if (onStackMeta) {
    let accumsBySeriesIdx = data.map((vals, i) => {
      let stackIdx = stackingGroups.findIndex((group) => group.series.indexOf(i) > -1);
      return stackIdx !== -1 ? accums[stackIdx] : vals;
    });

    onStackMeta({
      totals: accumsBySeriesIdx as AlignedData,
    });
  }

  // re-compute by percent
  frame.fields.forEach((field, i) => {
    if (i === 0 || field.config.custom?.hideFrom?.viz) {
      return;
    }

    let stackingMode = field.config.custom?.stacking?.mode;

    if (stackingMode === StackingMode.Percent) {
      let stackIdx = stackingGroups.findIndex((group) => group.series.indexOf(i) > -1);
      let accum = accums[stackIdx];
      let group = stackingGroups[stackIdx];

      let stacked = data[i];

      for (let i = 0; i < dataLen; i++) {
        let v = stacked[i];

        if (v != null) {
          // v / accum will always be pos, so properly (re)sign by group stacking dir
          stacked[i] = accum[i] === 0 ? 0 : group.dir * (v / accum[i]);
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
