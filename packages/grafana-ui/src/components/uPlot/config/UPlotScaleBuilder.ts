import uPlot, { Scale } from 'uplot';
import { PlotConfigBuilder } from '../types';

export interface ScaleProps {
  scaleKey: string;
  isTime?: boolean;
  min?: number | null;
  max?: number | null;
}

export class UPlotScaleBuilder extends PlotConfigBuilder<ScaleProps, Scale> {
  merge(props: ScaleProps) {
    this.props.min = optMinMax('min', this.props.min, props.min);
    this.props.max = optMinMax('max', this.props.max, props.max);
  }

  getConfig() {
    const { isTime, scaleKey } = this.props;
    if (isTime) {
      return {
        [scaleKey]: {
          time: true, // TODO?  this should be based on the query range, not the data
        },
      };
    }
    return {
      [scaleKey]: {
        range: (u: uPlot, dataMin: number, dataMax: number) => {
          const { min, max } = this.props;
          const [smin, smax] = uPlot.rangeNum(min ?? dataMin, max ?? dataMax, 0.1 as any, true);
          return [min ?? smin, max ?? smax];
        },
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
