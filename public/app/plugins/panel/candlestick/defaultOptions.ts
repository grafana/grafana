import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { defaultOptions as defaultOptionsBase, Options } from './panelcfg.gen';

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
