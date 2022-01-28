import { GraphFieldConfig, VisibilityMode } from '@grafana/schema';
import { Field, FieldType, PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { HeatmapPanel } from './HeatmapPanel';
import {
  PanelOptions,
  defaultPanelOptions,
  HeatmapSourceMode,
  HeatmapColorMode,
  HeatmapColorScale,
} from './models.gen';
import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';
import { HeatmapSuggestionsSupplier } from './suggestions';
import { heatmapChangedHandler } from './migrations';
import { addHeatmapCalculationOptions } from 'app/core/components/TransformersUI/calculateHeatmap/editor/helper';
import { colorSchemes } from './palettes';

export const plugin = new PanelPlugin<PanelOptions, GraphFieldConfig>(HeatmapPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelChangeHandler(heatmapChangedHandler)
  // .setMigrationHandler(heatmapMigrationHandler)
  .setPanelOptions((builder, context) => {
    const opts = context.options ?? defaultPanelOptions;

    let category = ['Heatmap data'];

    builder.addRadio({
      path: 'source',
      name: 'Source',
      defaultValue: HeatmapSourceMode.Auto,
      category,
      settings: {
        options: [
          { label: 'Auto', value: HeatmapSourceMode.Auto },
          { label: 'Calculate', value: HeatmapSourceMode.Calculate },
          { label: 'Raw data', description: 'The results are already heatmap buckets', value: HeatmapSourceMode.Data },
        ],
      },
    });

    if (opts.source === HeatmapSourceMode.Calculate) {
      addHeatmapCalculationOptions('heatmap.', builder, opts.heatmap, category);
    } else if (opts.source === HeatmapSourceMode.Data) {
      // builder.addSliderInput({
      //   name: 'heatmap from the data...',
      //   path: 'xxx',
      // });
    }

    builder.addFieldNamePicker({
      path: `color.field`,
      name: 'Color with field',
      category,
      settings: {
        filter: (f: Field) => f.type === FieldType.number,
        noFieldsMessage: 'No numeric fields found',
        placeholderText: 'Auto',
      },
    });

    category = ['Heatmap colors'];

    builder.addRadio({
      path: `color.mode`,
      name: 'Mode',
      defaultValue: defaultPanelOptions.color.mode,
      category,
      settings: {
        options: [
          { label: 'Scheme', value: HeatmapColorMode.Scheme },
          { label: 'Opacity', value: HeatmapColorMode.Opacity },
        ],
      },
    });

    if (opts.color.mode === HeatmapColorMode.Opacity) {
      builder.addColorPicker({
        path: `color.fill`,
        name: 'Color',
        description: 'NOTE: not used yet!',
        defaultValue: defaultPanelOptions.color.fill,
        category,
      });

      builder.addRadio({
        path: `color.scale`,
        name: 'Scale',
        description: '',
        defaultValue: defaultPanelOptions.color.scale,
        category,
        settings: {
          options: [
            { label: 'Exponential', value: HeatmapColorScale.Exponential },
            { label: 'Linear', value: HeatmapColorScale.Linear },
          ],
        },
      });

      if (opts.color.scale === HeatmapColorScale.Exponential) {
        builder.addSliderInput({
          path: 'color.exponent',
          name: 'Exponent',
          defaultValue: defaultPanelOptions.color.exponent,
          category,
          settings: {
            min: 0.1, // 1 for on/off?
            max: 2,
            step: 0.1,
          },
        });
      }
    } else {
      builder.addSelect({
        path: `color.scheme`,
        name: 'Scheme',
        description: '',
        defaultValue: defaultPanelOptions.color.scheme,
        category,
        settings: {
          options: colorSchemes.map((scheme) => ({
            value: scheme.name,
            label: scheme.name,
            //description: 'Set a geometry field based on the results of other fields',
          })),
        },
      });
    }

    builder.addSliderInput({
      path: 'color.steps',
      name: 'Max steps',
      defaultValue: defaultPanelOptions.color.steps,
      category,
      settings: {
        min: 2, // 1 for on/off?
        max: 128,
        step: 1,
      },
    });

    category = ['Cell display'];

    builder
      .addRadio({
        path: 'showValue',
        name: 'Show values',
        defaultValue: defaultPanelOptions.showValue,
        category,
        settings: {
          options: [
            { value: VisibilityMode.Auto, label: 'Auto' },
            { value: VisibilityMode.Always, label: 'Always' },
            { value: VisibilityMode.Never, label: 'Never' },
          ],
        },
      })
      .addSliderInput({
        name: 'Cell padding',
        path: 'cellPadding',
        defaultValue: defaultPanelOptions.cellPadding,
        category,
        settings: {
          min: -10,
          max: 20,
        },
      })
      .addSliderInput({
        name: 'Cell radius',
        path: 'cellRadius',
        defaultValue: defaultPanelOptions.cellRadius,
        category,
        settings: {
          min: 0,
          max: 100,
        },
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setSuggestionsSupplier(new HeatmapSuggestionsSupplier());
