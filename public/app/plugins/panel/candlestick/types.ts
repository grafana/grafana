import { LegendDisplayMode, LegendPlacement, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import {
  CandlestickColors,
  CandlestickFieldMap,
  CandleStyle,
  ColorStrategy,
  defaultCandlestickColors,
  defaultOptions as defaultOptionsBase,
  FieldConfig,
  Options,
  VizDisplayMode,
} from './panelcfg.gen';

export const defaultOptions: Partial<Options> = {
  ...defaultOptionsBase,
  // TODO: This should be included in the cue schema in the future.
  legend: {
    displayMode: LegendDisplayMode.List,
    showLegend: true,
    placement: LegendPlacement.Bottom,
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
