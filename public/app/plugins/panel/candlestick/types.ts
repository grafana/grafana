import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

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
  tooltip: {
    mode: TooltipDisplayMode.Multi,
    sort: SortOrder.None,
  },
};

export {
  type Options,
  type CandlestickColors,
  defaultCandlestickColors,
  CandleStyle,
  ColorStrategy,
  VizDisplayMode,
  type CandlestickFieldMap,
  type FieldConfig,
};
