import { LegendDisplayMode } from '@grafana/schema';

import {
  defaultPanelOptions as defaultPanelOptionsBase,
  defaultCandlestickColors,
  PanelOptions,
  CandlestickColors,
  CandleStyle,
  ColorStrategy,
  VizDisplayMode,
  CandlestickFieldMap,
  PanelFieldConfig,
  PanelCfgModelVersion,
} from './panelcfg.gen';

export const defaultPanelOptions: Partial<PanelOptions> = {
  ...defaultPanelOptionsBase,
  colors: defaultCandlestickColors as CandlestickColors,
  // TODO: This should be included in the cue schema in the future.
  legend: {
    displayMode: LegendDisplayMode.List,
    showLegend: true,
    placement: 'bottom',
    calcs: [],
  },
};

export {
  PanelOptions,
  CandlestickColors,
  defaultCandlestickColors,
  CandleStyle,
  ColorStrategy,
  VizDisplayMode,
  CandlestickFieldMap,
  PanelFieldConfig,
  PanelCfgModelVersion,
};
