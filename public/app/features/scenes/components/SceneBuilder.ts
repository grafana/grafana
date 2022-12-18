import { GraphFieldConfig, TableFieldOptions } from '@grafana/schema';
import { PanelOptions as BarGaugePanelOptions } from 'app/plugins/panel/bargauge/models.gen';
import { PanelOptions as TablePanelOptions } from 'app/plugins/panel/table/models.gen';
import { TimeSeriesOptions } from 'app/plugins/panel/timeseries/types';

import { VizPanel, VizPanelState } from './VizPanel/VizPanel';

export type TypedVizPanelState<TOptions, TFieldConfig> = Omit<VizPanelState, 'pluginId'>;

export class SceneBuilder {
  public newGraph(state: TypedVizPanelState<TimeSeriesOptions, GraphFieldConfig>) {
    return new VizPanel({
      ...state,
      pluginId: 'timeseries',
    });
  }

  public newTable(state: TypedVizPanelState<TablePanelOptions, TableFieldOptions>) {
    return new VizPanel<TablePanelOptions, TableFieldOptions>({
      ...state,
      pluginId: 'table',
    });
  }

  public newBarGauge(state: TypedVizPanelState<BarGaugePanelOptions, {}>) {
    return new VizPanel({
      ...state,
      pluginId: 'bargauge',
    });
  }
}
