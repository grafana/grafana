import { Scale } from 'uplot';
import { PlotConfigBuilder } from '../types';

export interface ScaleProps {
  scaleKey: string;
  isTime?: boolean;
}

export class UPlotScaleBuilder extends PlotConfigBuilder<ScaleProps, Scale> {
  getConfig() {
    const { isTime, scaleKey } = this.props;
    return {
      [scaleKey]: {
        time: !!isTime,
      },
    };
  }
}
