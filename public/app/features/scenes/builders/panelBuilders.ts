import { VizPanel, VizPanelState } from '@grafana/scenes';
import { GraphFieldConfig, TableFieldOptions } from '@grafana/schema';
import { Options as TablePanelOptions } from '@grafana/schema/src/raw/composable/table/panelcfg/x/TablePanelCfg_types.gen';
import { Options as TimeSeriesOptions } from '@grafana/schema/src/raw/composable/timeseries/panelcfg/x/TimeSeriesPanelCfg_types.gen';
import { Options as BarGaugePanelOptions } from 'app/plugins/panel/bargauge/panelcfg.gen';

export type TypedVizPanelState<TOptions, TFieldConfig> = Omit<
  Partial<VizPanelState<TOptions, TFieldConfig>>,
  'pluginId'
>;

export const panelBuilders = {
  newTable: (state: TypedVizPanelState<TablePanelOptions, TableFieldOptions>) => {
    return new VizPanel<TablePanelOptions, TableFieldOptions>({
      ...state,
      pluginId: 'table',
    });
  },
  newGraph: (state: TypedVizPanelState<TimeSeriesOptions, GraphFieldConfig>) => {
    return new VizPanel({
      ...state,
      pluginId: 'timeseries',
    });
  },
  newBarGauge: (state: TypedVizPanelState<BarGaugePanelOptions, {}>) => {
    return new VizPanel({
      ...state,
      pluginId: 'bargauge',
    });
  },
};
