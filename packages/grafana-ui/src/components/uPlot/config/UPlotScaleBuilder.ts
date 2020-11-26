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
    const { isTime, scaleKey, min, max } = this.props;
    if (isTime) {
      return {
        [scaleKey]: {
          time: true, // no explicit ranges for time?
        },
      };
    }
    return {
      [scaleKey]: {
        range: (u: uPlot, initMin: number, initMax: number) => {
          const [rmin, rmax] = uPlot.rangeNum(initMin, initMax, 0.05 as any, true);
          return [min ?? rmin, max ?? rmax];
        },
      },
    };
  }
}
