import uPlot, { Scale, Range } from 'uplot';

import { DecimalCount, incrRoundDn, incrRoundUp, isBooleanUnit } from '@grafana/data';
import { ScaleOrientation, ScaleDirection, ScaleDistribution } from '@grafana/schema';

import { PlotConfigBuilder } from '../types';

export interface ScaleProps {
  scaleKey: string;
  isTime?: boolean;
  min?: number | null;
  max?: number | null;
  softMin?: number | null;
  softMax?: number | null;
  range?: Scale.Range;
  distribution?: ScaleDistribution;
  orientation: ScaleOrientation;
  direction: ScaleDirection;
  log?: number;
  linearThreshold?: number;
  centeredZero?: boolean;
  decimals?: DecimalCount;
}

export class UPlotScaleBuilder extends PlotConfigBuilder<ScaleProps, Scale> {
  merge(props: ScaleProps) {
    this.props.min = optMinMax('min', this.props.min, props.min);
    this.props.max = optMinMax('max', this.props.max, props.max);
  }

  getConfig(): Scale {
    let {
      isTime,
      scaleKey,
      min: hardMin,
      max: hardMax,
      softMin,
      softMax,
      range,
      direction,
      orientation,
      centeredZero,
      decimals,
    } = this.props;

    const distr = this.props.distribution;

    const distribution = !isTime
      ? {
          distr:
            distr === ScaleDistribution.Symlog
              ? 4
              : distr === ScaleDistribution.Log
              ? 3
              : distr === ScaleDistribution.Ordinal
              ? 2
              : 1,
          log: distr === ScaleDistribution.Log || distr === ScaleDistribution.Symlog ? this.props.log ?? 2 : undefined,
          asinh: distr === ScaleDistribution.Symlog ? this.props.linearThreshold ?? 1 : undefined,
        }
      : {};

    // guard against invalid log scale limits <= 0, or snap to log boundaries
    if (distr === ScaleDistribution.Log) {
      let logBase = this.props.log!;
      let logFn = logBase === 2 ? Math.log2 : Math.log10;

      if (hardMin != null) {
        if (hardMin <= 0) {
          hardMin = null;
        } else {
          hardMin = logBase ** Math.floor(logFn(hardMin));
        }
      }

      if (hardMax != null) {
        if (hardMax <= 0) {
          hardMax = null;
        } else {
          hardMax = logBase ** Math.ceil(logFn(hardMax));
        }
      }

      if (softMin != null) {
        if (softMin <= 0) {
          softMin = null;
        } else {
          softMin = logBase ** Math.floor(logFn(softMin));
        }
      }

      if (softMax != null) {
        if (softMax <= 0) {
          softMax = null;
        } else {
          softMax = logBase ** Math.ceil(logFn(softMax));
        }
      }
    }
    /*
    // snap to symlog boundaries
    else if (distr === ScaleDistribution.Symlog) {
      let logBase = this.props.log!;
      let logFn = logBase === 2 ? Math.log2 : Math.log10;

      let sign = Math.sign(hardMin);

      if (hardMin != null) {
        hardMin = logBase ** Math.floor(logFn(hardMin));
      }

      if (hardMax != null) {
        hardMax = logBase ** Math.ceil(logFn(hardMax));
      }

      if (softMin != null) {
        softMin = logBase ** Math.floor(logFn(softMin));
      }

      if (softMax != null) {
        softMax = logBase ** Math.ceil(logFn(softMax));
      }
    }
    */

    // uPlot's default ranging config for both min & max is {pad: 0.1, hard: null, soft: 0, mode: 3}
    let softMinMode: Range.SoftMode = softMin == null ? 3 : 1;
    let softMaxMode: Range.SoftMode = softMax == null ? 3 : 1;

    const rangeConfig: Range.Config = {
      min: {
        pad: 0.1,
        hard: hardMin ?? -Infinity,
        soft: softMin || 0,
        mode: softMinMode,
      },
      max: {
        pad: 0.1,
        hard: hardMax ?? Infinity,
        soft: softMax || 0,
        mode: softMaxMode,
      },
    };

    let hardMinOnly = softMin == null && hardMin != null;
    let hardMaxOnly = softMax == null && hardMax != null;
    let hasFixedRange = hardMinOnly && hardMaxOnly;

    const rangeFn: uPlot.Range.Function = (
      u: uPlot,
      dataMin: number | null,
      dataMax: number | null,
      scaleKey: string
    ) => {
      const scale = u.scales[scaleKey];

      let minMax: uPlot.Range.MinMax = [dataMin, dataMax];

      // don't pad numeric x scales
      if (scaleKey === 'x' && !isTime) {
        return minMax;
      }

      // happens when all series on a scale are `show: false`, re-returning nulls will auto-disable axis
      if (!hasFixedRange && dataMin == null && dataMax == null) {
        return minMax;
      }

      let logBase = scale.log ?? 10;

      if (scale.distr === 1 || scale.distr === 2 || scale.distr === 4) {
        if (centeredZero) {
          let absMin = Math.abs(dataMin!);
          let absMax = Math.abs(dataMax!);
          let max = Math.max(absMin, absMax);
          dataMin = -max;
          dataMax = max;
        }

        if (scale.distr === 4) {
          minMax = uPlot.rangeAsinh(dataMin!, dataMax!, logBase, true);
        } else {
          // @ts-ignore here we may use hardMin / hardMax to make sure any extra padding is computed from a more accurate delta
          minMax = uPlot.rangeNum(hardMinOnly ? hardMin : dataMin, hardMaxOnly ? hardMax : dataMax, rangeConfig);
        }
      } else if (scale.distr === 3) {
        minMax = uPlot.rangeLog(hardMin ?? dataMin!, hardMax ?? dataMax!, logBase, true);
      }

      if (decimals === 0) {
        if (scale.distr === 1 || scale.distr === 2) {
          minMax[0] = incrRoundDn(minMax[0]!, 1);
          minMax[1] = incrRoundUp(minMax[1]!, 1);
        }
        // log2 or log10 scale min must be clamped to 1
        else if (scale.distr === 3) {
          let logFn = scale.log === 2 ? Math.log2 : Math.log10;

          if (minMax[0]! <= 1) {
            // clamp min
            minMax[0] = 1;
          } else {
            // snap min to nearest mag below
            let minExp = Math.floor(logFn(minMax[0]!));
            minMax[0] = logBase ** minExp;
          }

          // snap max to nearest mag above
          let maxExp = Math.ceil(logFn(minMax[1]!));
          minMax[1] = logBase ** maxExp;

          // inflate max by mag if same
          if (minMax[0] === minMax[1]) {
            minMax[1] *= logBase;
          }
        }
        // TODO: this should be better. symlog values can be <= 0, but should also be snapped to log2 or log10 boundaries
        // for now we just do same as linear snapping above, so may have non-neat range and ticks at edges
        else if (scale.distr === 4) {
          minMax[0] = incrRoundDn(minMax[0]!, 1);
          minMax[1] = incrRoundUp(minMax[1]!, 1);
        }
      }

      if (scale.distr === 1 || scale.distr === 4) {
        // if all we got were hard limits, treat them as static min/max
        if (hardMinOnly) {
          minMax[0] = hardMin!;
        }

        if (hardMaxOnly) {
          minMax[1] = hardMax!;
        }
      }

      // guard against invalid y ranges
      if (minMax[0]! >= minMax[1]!) {
        minMax[0] = scale.distr === 3 ? 1 : 0;
        minMax[1] = 100;
      }

      return minMax;
    };

    let auto = !isTime && !hasFixedRange;

    if (isBooleanUnit(scaleKey)) {
      auto = false;
      range = [0, 1];
    }

    return {
      [scaleKey]: {
        time: isTime,
        auto,
        range: range ?? rangeFn,
        dir: direction,
        ori: orientation,
        ...distribution,
      },
    };
  }
}

export function optMinMax(minmax: 'min' | 'max', a?: number | null, b?: number | null): undefined | number | null {
  const hasA = !(a === undefined || a === null);
  const hasB = !(b === undefined || b === null);
  if (hasA) {
    if (!hasB) {
      return a;
    }
    if (minmax === 'min') {
      return a! < b! ? a : b;
    }
    return a! > b! ? a : b;
  }
  return b;
}
