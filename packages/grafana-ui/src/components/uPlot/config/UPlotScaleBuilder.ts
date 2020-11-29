import uPlot, { Scale } from 'uplot';
import { PlotConfigBuilder } from '../types';

export interface ScaleProps {
  scaleKey: string;
  isTime?: boolean;
  min?: number | null;
  max?: number | null;
}

export class UPlotScaleBuilder extends PlotConfigBuilder<ScaleProps, Scale> {
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
