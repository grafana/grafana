import isNumber from 'lodash/isNumber';
import { Scale } from 'uplot';
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
    const range = isNumber(min) && isNumber(max) ? [min, max] : undefined;
    return {
      [scaleKey]: {
        time: !!isTime,
        range,
      },
    };
  }
}
