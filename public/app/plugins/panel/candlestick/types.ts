import { LegendDisplayMode } from '@grafana/schema';

import {
  defaultOptions as defaultOptionsBase,
  defaultCandlestickColors,
  Options,
  CandlestickColors,
  CandleStyle,
  ColorStrategy,
  VizDisplayMode,
  CandlestickFieldMap,
  FieldConfig,
} from './panelcfg.gen';

export const defaultOptions: Partial<Options> = {
  ...defaultOptionsBase,
  // TODO: This should be included in the cue schema in the future.
  legend: {
    displayMode: LegendDisplayMode.List,
    showLegend: true,
    placement: 'bottom',
    calcs: [],
  },
};

export {
  Options,
  CandlestickColors,
  defaultCandlestickColors,
  CandleStyle,
  ColorStrategy,
  VizDisplayMode,
  CandlestickFieldMap,
  FieldConfig,
};
