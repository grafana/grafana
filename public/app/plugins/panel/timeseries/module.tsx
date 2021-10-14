import { GraphFieldConfig } from '@grafana/schema';
import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { TimeSeriesPanel } from './TimeSeriesPanel';
import { graphPanelChangedHandler } from './migrations';
import { TimeSeriesOptions } from './types';
import { defaultGraphConfig, getGraphFieldConfig } from './config';
import { getSuggestions } from './suggestions';

export const plugin = new PanelPlugin<TimeSeriesOptions, GraphFieldConfig>(TimeSeriesPanel)
  .setPanelChangeHandler(graphPanelChangedHandler)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setSuggestionsSupplier(getSuggestions)
  .setDataSupport({ annotations: true, alertStates: true });
