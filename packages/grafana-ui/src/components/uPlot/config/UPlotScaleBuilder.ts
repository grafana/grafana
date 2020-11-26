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
          time: true, // no explicit ranges for time?
        },
      };
    }
    return {
      [scaleKey]: {
        range: (u: uPlot, dataMin: number, dataMax: number) => {
          const { min, max } = this.props;
          const [smin, smax] = uPlot.rangeNum(dataMin, dataMax, 0.05 as any, true);
          return [min ?? smin, max ?? smax];
        },
      },
    };
  }
}
