import { GraphFieldConfig } from '@grafana/schema';
import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { HeatmapPanel } from './HeatmapPanel';
import { PanelOptions, defaultPanelOptions, HeatmapSourceMode } from './models.gen';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { HeatmapSuggestionsSupplier } from './suggestions';
import { heatmapChangedHandler } from './migrations';
import { addHeatmapCalculationOptions } from 'app/core/components/TransformersUI/calculateHeatmap/editor/helper';
import { palettes9 } from './palettes';

export const plugin = new PanelPlugin<PanelOptions, GraphFieldConfig>(HeatmapPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelChangeHandler(heatmapChangedHandler)
  // .setMigrationHandler(heatmapMigrationHandler)
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
      addHeatmapCalculationOptions('heatmap.', builder, opts.heatmap);
    } else if (opts.source === HeatmapSourceMode.Data) {
      // builder.addSliderInput({
      //   name: 'heatmap from the data...',
      //   path: 'xxx',
      // });
    }

    builder.addSelect({
      path: `scheme`,
      name: 'Color scheme',
      description: '',
      defaultValue: 'Oranges',
      settings: {
        options: Object.keys(palettes9).map((name) => ({
          value: name,
          label: name,
          //description: 'Set a geometry field based on the results of other fields',
        })),
      },
    });

    builder.addNumberInput({
      name: 'Cell padding',
      path: 'cellPadding',
      defaultValue: 0,
      settings: {
        min: -10,
        max: 20,
      },
    });
    builder.addNumberInput({
      name: 'Cell radius',
      path: 'cellRadius',
      defaultValue: 0,
      settings: {
        min: 0,
        max: 100,
      },
    });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setSuggestionsSupplier(new HeatmapSuggestionsSupplier());
