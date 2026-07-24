import uPlot, { type Scale, type Range } from 'uplot';

import { type DecimalCount, incrRoundDn, incrRoundUp, isBooleanUnit } from '@grafana/data';
import { type ScaleOrientation, type ScaleDirection, ScaleDistribution, StackingMode } from '@grafana/schema';

import { PlotConfigBuilder } from '../types';

export interface ScaleProps {
  scaleKey: string;
  isTime?: boolean;
  auto?: boolean;
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
  stackingMode?: StackingMode;
  padMinBy?: number;
  padMaxBy?: number;
}

const isValidLogBase = (v: number | undefined): v is Scale.LogBase => v === 2 || v === 10;

// only used if no log is passed in from the consumer of UPlotScaleBuilder and logrithmic distribution is selected.
// we probably want to avoid this fallback!
const FALLBACK_LOG: Scale.LogBase = 10;

// mapping between uPlot and our ScaleDistribution enum values
const DISTR_MAP: Record<ScaleDistribution, uPlot.Scale.Distr> = {
  [ScaleDistribution.Linear]: 1,
  [ScaleDistribution.Ordinal]: 2,
  [ScaleDistribution.Log]: 3,
  [ScaleDistribution.Symlog]: 4,
  // custom is 100 in uPlot, but we don't support it so not mapping here
};

export class UPlotScaleBuilder extends PlotConfigBuilder<ScaleProps, Scale> {
  merge(props: ScaleProps) {
    this.props.min = optMinMax('min', this.props.min, props.min);
    this.props.max = optMinMax('max', this.props.max, props.max);
  }

  getConfig(): uPlot.Scales {
    let {
      isTime,
      auto,
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
      stackingMode,
      padMinBy = 0.1,
      padMaxBy = 0.1,
    } = this.props;

    if (stackingMode === StackingMode.Percent) {
      if (hardMin == null && softMin == null) {
        softMin = 0;
      }

      if (hardMax == null && softMax == null) {
        softMax = 1;
      }
    }

    const distr = this.props.distribution;
    const safeLog = isValidLogBase(this.props.log) ? this.props.log : FALLBACK_LOG;

    const distribution = !isTime
      ? {
          distr: distr ? DISTR_MAP[distr] : DISTR_MAP[ScaleDistribution.Linear],
          log: distr === ScaleDistribution.Log || distr === ScaleDistribution.Symlog ? safeLog : undefined,
          asinh: distr === ScaleDistribution.Symlog ? (this.props.linearThreshold ?? 1) : undefined,
        }
      : {};

    // guard against invalid log scale limits <= 0, or snap to log boundaries
    if (distr === ScaleDistribution.Log) {
      const logFn = safeLog === 2 ? Math.log2 : Math.log10;

      if (hardMin != null) {
        if (hardMin <= 0) {
          hardMin = null;
        } else {
          hardMin = safeLog ** Math.floor(logFn(hardMin));
        }
      }

      if (hardMax != null) {
        if (hardMax <= 0) {
          hardMax = null;
        } else {
          hardMax = safeLog ** Math.ceil(logFn(hardMax));
        }
      }

      if (softMin != null) {
        if (softMin <= 0) {
          softMin = null;
        } else {
          softMin = safeLog ** Math.floor(logFn(softMin));
        }
      }

      if (softMax != null) {
        if (softMax <= 0) {
          softMax = null;
        } else {
          softMax = safeLog ** Math.ceil(logFn(softMax));
        }
      }
    }

    // uPlot's default ranging config for both min & max is {pad: 0.1, hard: null, soft: 0, mode: 3}
    const softMinMode: Range.SoftMode = softMin == null ? 3 : 1;
    const softMaxMode: Range.SoftMode = softMax == null ? 3 : 1;

    const rangeConfig: Range.Config = {
      min: {
        pad: padMinBy,
        hard: hardMin ?? -Infinity,
        soft: softMin || 0,
        mode: softMinMode,
      },
      max: {
        pad: padMaxBy,
        hard: hardMax ?? Infinity,
        soft: softMax || 0,
        mode: softMaxMode,
      },
    };

    const hardMinOnly = softMin == null && hardMin != null;
    const hardMaxOnly = softMax == null && hardMax != null;
    const hasFixedRange = hardMinOnly && hardMaxOnly;

    const rangeFn: uPlot.Range.Function = (
      u: uPlot,
      dataMin: number | null,
      dataMax: number | null,
      scaleKey: string
    ) => {
      const scale = u.scales[scaleKey];

      let minMax: uPlot.Range.MinMax = [dataMin, dataMax];

      // happens when all series on a scale are `show: false`, re-returning nulls will auto-disable axis
      if (!hasFixedRange && dataMin == null && dataMax == null) {
        return minMax;
      }

      const logBase = scale.log ?? FALLBACK_LOG;

      if (
        scale.distr === DISTR_MAP[ScaleDistribution.Linear] ||
        scale.distr === DISTR_MAP[ScaleDistribution.Ordinal] ||
        scale.distr === DISTR_MAP[ScaleDistribution.Symlog]
      ) {
        if (centeredZero) {
          const absMin = Math.abs(dataMin!);
          const absMax = Math.abs(dataMax!);
          let max = Math.max(absMin, absMax);

          // flat 0
          if (max === 0) {
            max = 80;
          }

          dataMin = -max;
          dataMax = max;
        }

        if (scale.distr === 4) {
          minMax = uPlot.rangeAsinh(dataMin!, dataMax!, logBase, true);
        } else {
          // @ts-ignore here we may use hardMin / hardMax to make sure any extra padding is computed from a more accurate delta
          minMax = uPlot.rangeNum(hardMinOnly ? hardMin : dataMin, hardMaxOnly ? hardMax : dataMax, rangeConfig);
        }
      } else if (scale.distr === DISTR_MAP[ScaleDistribution.Log]) {
        minMax = uPlot.rangeLog(hardMin ?? dataMin!, hardMax ?? dataMax!, logBase, true);
      }

      if (decimals === 0) {
        if (
          scale.distr === DISTR_MAP[ScaleDistribution.Linear] ||
          scale.distr === DISTR_MAP[ScaleDistribution.Ordinal]
        ) {
          minMax[0] = incrRoundDn(minMax[0]!, 1);
          minMax[1] = incrRoundUp(minMax[1]!, 1);
        }
        // log2 or log10 scale min must be clamped to 1
        else if (scale.distr === DISTR_MAP[ScaleDistribution.Log]) {
          const logFn = scale.log === 2 ? Math.log2 : Math.log10;

          if (minMax[0]! <= 1) {
            // clamp min
            minMax[0] = 1;
          } else {
            // snap min to nearest mag below
            const minExp = Math.floor(logFn(minMax[0]!));
            minMax[0] = logBase ** minExp;
          }

          // snap max to nearest mag above
          const maxExp = Math.ceil(logFn(minMax[1]!));
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

      // for tiny ranges like 0.999999999811111, 1, uPlot's rangeNum may return [1,1]
      if (minMax[0]! === minMax[1]! && minMax[0]! !== 0) {
        // only applies to linear scales
        if (scale.distr === 1) {
          if (minMax[0] < 0) {
            minMax[0] *= 2;
            minMax[1] = 0;
          } else {
            minMax[1] *= 2;
            minMax[0] = 0;
          }
        }
      }

      // guard against invalid y ranges
      if (minMax[0]! >= minMax[1]!) {
        minMax[0] = scale.distr === DISTR_MAP[ScaleDistribution.Log] ? 1 : 0;
        minMax[1] = 100;
      }

      return minMax;
    };

    auto ??= !isTime && !hasFixedRange;

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
