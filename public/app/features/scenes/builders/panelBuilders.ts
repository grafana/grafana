import { VizPanel, VizPanelState } from '@grafana/scenes';
import { GraphFieldConfig, TableFieldOptions } from '@grafana/schema';
import { PanelOptions as BarGaugePanelOptions } from 'app/plugins/panel/bargauge/panelcfg.gen';
import { PanelOptions as TablePanelOptions } from 'app/plugins/panel/table/panelcfg.gen';
import { PanelOptions as TimeSeriesOptions } from 'app/plugins/panel/timeseries/panelcfg.gen';

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
