import { PanelPlugin } from '@grafana/data';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode, type GraphFieldConfig } from '@grafana/schema';
import { TimeSeriesPanel } from 'app/plugins/panel/timeseries/TimeSeriesPanel';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { type Options } from 'app/plugins/panel/timeseries/panelcfg.gen';

import { type EmbedPanelType } from './types';

/**
 * Panel option defaults. In the app these are harvested from the options builder in
 * module.tsx, which is editor UI, so an embed states the value defaults directly.
 * Field config defaults are NOT here: those come from the real field config registry
 * built out of getGraphFieldConfig below.
 */
const optionDefaults: Partial<Options> = {
  legend: {
    showLegend: true,
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  },
  tooltip: {
    mode: TooltipDisplayMode.Multi,
    sort: SortOrder.None,
  },
};

export const timeseries: EmbedPanelType = {
  pluginId: 'timeseries',
  optionDefaults,
  // Building the plugin ourselves rather than importing module.tsx keeps the options
  // editor UI out of the bundle while still producing the panel's real
  // fieldConfigRegistry. Same approach Explore uses in ExploreGraph.tsx.
  createPlugin: () =>
    new PanelPlugin<Options, GraphFieldConfig>(TimeSeriesPanel).useFieldConfig(getGraphFieldConfig(defaultGraphConfig)),
};
