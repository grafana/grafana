import { PanelPlugin } from '@grafana/data';
import { GraphFieldConfig } from '@grafana/ui';
import { TimeSeriesPanel } from './TimeSeriesPanel';
import { graphPanelChangedHandler } from './migrations';
import { Options } from './types';
import { addLegendOptions, defaultGraphConfig, getGraphFieldConfig } from './config';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(TimeSeriesPanel)
  .setPanelChangeHandler(graphPanelChangedHandler)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    builder.addRadio({
      path: 'tooltipOptions.mode',
      name: 'Tooltip mode',
      description: '',
      defaultValue: 'single',
      settings: {
        options: [
          { value: 'single', label: 'Single' },
          { value: 'multi', label: 'All' },
          { value: 'none', label: 'Hidden' },
        ],
      },
    });
    addLegendOptions(builder);
  });
