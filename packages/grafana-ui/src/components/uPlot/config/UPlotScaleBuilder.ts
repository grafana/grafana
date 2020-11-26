import isNumber from 'lodash/isNumber';
import uPlot, { Scale, Range } from 'uplot';
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

    console.log('INIT SCALE', scaleKey);
    let range: Range.Function | Range.MinMax | undefined = undefined;
    if (isNumber(min)) {
      if (isNumber(max)) {
        range = [min!, max!];
        console.log('MAX AND MIN');
      } else {
        range = (u: uPlot, initMin: number, initMax: number) => {
          let [rmin, rmax] = uPlot.rangeNum(initMin, initMax, 0.05 as any, true);
          console.log('ONLY MIN', { rmin, rmax, initMin, initMax });
          return [min, rmax];
        };
      }
    } else if (isNumber(max)) {
      range = (u: uPlot, initMin: number, initMax: number) => {
        let [rmin, rmax] = uPlot.rangeNum(initMin, initMax, 0.1 as any, true);
        console.log('ONLY MAX', { rmin, rmax, initMin, initMax });
        return [rmin, max];
      };
    }

    return {
      [scaleKey]: {
        time: !!isTime,
        range,
      },
    };
  }
}
