import uPlot, { Scale } from 'uplot';
import { PlotConfigBuilder } from '../types';

export interface ScaleProps {
  scaleKey: string;
  isTime?: boolean;
  min?: number | null;
  max?: number | null;
  range?: () => number[]; // min/max
}

export class UPlotScaleBuilder extends PlotConfigBuilder<ScaleProps, Scale> {
  merge(props: ScaleProps) {
    this.props.min = optMinMax('min', this.props.min, props.min);
    this.props.max = optMinMax('max', this.props.max, props.max);
  }

  // uPlot range function
  range = (u: uPlot, dataMin: number, dataMax: number) => {
    const { min, max } = this.props;
    const [smin, smax] = uPlot.rangeNum(min ?? dataMin, max ?? dataMax, 0.1 as any, true);
    return [min ?? smin, max ?? smax];
  };

  getConfig() {
    const { isTime, scaleKey, range } = this.props;
    return {
      [scaleKey]: {
        time: isTime,
        range: range ?? this.range,
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
