import uPlot, { Scale, Range } from 'uplot';

import { isBooleanUnit } from '@grafana/data';
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
  centeredZero?: boolean;
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
    } = this.props;
    const distribution = !isTime
      ? {
          distr:
            this.props.distribution === ScaleDistribution.Log
              ? 3
              : this.props.distribution === ScaleDistribution.Ordinal
              ? 2
              : 1,
          log: this.props.distribution === ScaleDistribution.Log ? this.props.log || 2 : undefined,
        }
      : {};

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

    // uPlot range function
    const rangeFn = (u: uPlot, dataMin: number | null, dataMax: number | null, scaleKey: string) => {
      const scale = u.scales[scaleKey];

      let minMax: uPlot.Range.MinMax = [dataMin, dataMax];

      // happens when all series on a scale are `show: false`, re-returning nulls will auto-disable axis
      if (!hasFixedRange && dataMin == null && dataMax == null) {
        return minMax;
      }

      if (scale.distr === 1 || scale.distr === 2) {
        if (centeredZero) {
          let absMin = Math.abs(dataMin!);
          let absMax = Math.abs(dataMax!);
          let max = Math.max(absMin, absMax);
          dataMin = -max;
          dataMax = max;
        }

        // @ts-ignore here we may use hardMin / hardMax to make sure any extra padding is computed from a more accurate delta
        minMax = uPlot.rangeNum(hardMinOnly ? hardMin : dataMin, hardMaxOnly ? hardMax : dataMax, rangeConfig);
      } else if (scale.distr === 3) {
        minMax = uPlot.rangeLog(dataMin!, dataMax!, scale.log ?? 10, true);
      }

      // if all we got were hard limits, treat them as static min/max
      if (hardMinOnly) {
        minMax[0] = hardMin!;
      }

      if (hardMaxOnly) {
        minMax[1] = hardMax!;
      }

      // guard against invalid y ranges
      if (minMax[0]! >= minMax[1]!) {
        minMax[0] = 0;
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
