import { GraphFieldConfig } from '@grafana/schema';
import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { HeatmapPanel } from './HeatmapPanel';
import { PanelOptions, defaultPanelOptions, HeatmapSourceMode } from './models.gen';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { HeatmapSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<PanelOptions, GraphFieldConfig>(HeatmapPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder, context) => {
    const opts = context.options ?? defaultPanelOptions;

    builder.addRadio({
      path: 'source',
      name: 'Source',
      defaultValue: HeatmapSourceMode.Auto,
      settings: {
        options: [
          { label: 'Auto', value: HeatmapSourceMode.Auto },
          { label: 'Calculate', value: HeatmapSourceMode.Calculate },
          { label: 'Data', value: HeatmapSourceMode.Data },
        ],
      },
    });

    if (opts.source === HeatmapSourceMode.Calculate) {
      builder.addSliderInput({
        name: 'TODO... calculate fields',
        path: 'xxx',
      });
    } else if (opts.source === HeatmapSourceMode.Data) {
      builder.addSliderInput({
        name: 'heatmap from the data...',
        path: 'xxx',
      });
    }

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setDataSupport({ annotations: true, alertStates: true })
  .setSuggestionsSupplier(new HeatmapSuggestionsSupplier());
