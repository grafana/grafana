import { PanelPlugin } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/ui';
import { TimeSeriesPanel } from './TimeSeriesPanel';
import { graphPanelChangedHandler } from './migrations';
import { TimeSeriesOptions } from './types';
import { addLegendOptions, addTooltipOptions, defaultGraphConfig, getGraphFieldConfig } from './config';

export const plugin = new PanelPlugin<TimeSeriesOptions, GraphFieldConfig>(TimeSeriesPanel)
  .setPanelChangeHandler(graphPanelChangedHandler)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    addTooltipOptions(builder);
    addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true });
