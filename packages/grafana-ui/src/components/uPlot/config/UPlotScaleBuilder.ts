import uPlot, { Scale, Range } from 'uplot';
import { PlotConfigBuilder } from '../types';
import { ScaleOrientation, ScaleDirection } from '../config';
import { ScaleDistribution } from '../models.gen';
import { isBooleanUnit } from '@grafana/data';

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
}

export class UPlotScaleBuilder extends PlotConfigBuilder<ScaleProps, Scale> {
  merge(props: ScaleProps) {
    this.props.min = optMinMax('min', this.props.min, props.min);
    this.props.max = optMinMax('max', this.props.max, props.max);
  }

  getConfig(): Scale {
    let { isTime, scaleKey, min: hardMin, max: hardMax, softMin, softMax, range, direction, orientation } = this.props;
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

    // uPlot range function
    const rangeFn = (u: uPlot, dataMin: number, dataMax: number, scaleKey: string) => {
      const scale = u.scales[scaleKey];

      let minMax = [dataMin, dataMax];

      if (scale.distr === 1 || scale.distr === 2) {
        // @ts-ignore here we may use hardMin / hardMax to make sure any extra padding is computed from a more accurate delta
        minMax = uPlot.rangeNum(hardMinOnly ? hardMin : dataMin, hardMaxOnly ? hardMax : dataMax, rangeConfig);
      } else if (scale.distr === 3) {
        minMax = uPlot.rangeLog(dataMin, dataMax, scale.log ?? 10, true);
      }

      // if all we got were hard limits, treat them as static min/max
      if (hardMinOnly) {
        minMax[0] = hardMin!;
      }

      if (hardMaxOnly) {
        minMax[1] = hardMax!;
      }

      return minMax;
    };

    let auto = !isTime && !(hardMinOnly && hardMaxOnly);
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
