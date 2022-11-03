import { FieldConfigSource } from '@grafana/data';
import { GraphFieldConfig, TableFieldOptions } from '@grafana/schema';
import { PanelOptions as BarGaugePanelOptions } from 'app/plugins/panel/bargauge/models.gen';
import { PanelOptions as TablePanelOptions } from 'app/plugins/panel/table/models.gen';
import { TimeSeriesOptions } from 'app/plugins/panel/timeseries/types';

import { VizPanel, VizPanelState } from './VizPanel';

export interface TypedVizPanelState<TOptions, TFieldConfig>
  extends Omit<VizPanelState, 'options' | 'fieldConfig' | 'pluginId'> {
  options: TOptions;
  fieldConfig: FieldConfigSource<TFieldConfig>;
}

export function newTablePanel(state: TypedVizPanelState<TablePanelOptions, TableFieldOptions>) {
  return new VizPanel({
    ...state,
    pluginId: 'table',
  });
}

export function newGraphPanel(state: TypedVizPanelState<TimeSeriesOptions, GraphFieldConfig>) {
  return new VizPanel({
    ...state,
    pluginId: 'timeseries',
  });
}

export function newBarGaugePanel(state: TypedVizPanelState<BarGaugePanelOptions, {}>) {
  return new VizPanel({
    ...state,
    pluginId: 'bargauge',
  });
}
