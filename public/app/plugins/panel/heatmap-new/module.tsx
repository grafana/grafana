import React from 'react';

import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { config } from '@grafana/runtime';
import { GraphFieldConfig } from '@grafana/schema';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { addHeatmapCalculationOptions } from 'app/features/transformers/calculateHeatmap/editor/helper';

import { HeatmapPanel } from './HeatmapPanel';
import { heatmapChangedHandler, heatmapMigrationHandler } from './migrations';
import { PanelOptions, defaultPanelOptions, HeatmapMode, HeatmapColorMode, HeatmapColorScale } from './models.gen';
import { colorSchemes, quantizeScheme } from './palettes';
import { HeatmapSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<PanelOptions, GraphFieldConfig>(HeatmapPanel)
  .useFieldConfig({
    disableStandardOptions: [FieldConfigProperty.Color, FieldConfigProperty.Thresholds],
  })
  .setPanelChangeHandler(heatmapChangedHandler)
  .setMigrationHandler(heatmapMigrationHandler)
  .setPanelOptions((builder, context) => {
    const opts = context.options ?? defaultPanelOptions;

    let category = ['Heatmap'];

    builder.addRadio({
      path: 'mode',
      name: 'Data',
      defaultValue: defaultPanelOptions.mode,
      category,
      settings: {
        options: [
          { label: 'Aggregated', value: HeatmapMode.Aggregated },
          { label: 'Calculate', value: HeatmapMode.Calculate },
          //  { label: 'Accumulated', value: HeatmapMode.Accumulated, description: 'The query response values are accumulated' },
        ],
      },
    });

    if (opts.mode === HeatmapMode.Calculate) {
      addHeatmapCalculationOptions('calculate.', builder, opts.calculate, category);
    }

    category = ['Colors'];

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

    builder.addColorPicker({
      path: `color.fill`,
      name: 'Color',
      defaultValue: defaultPanelOptions.color.fill,
      category,
      showIf: (opts) => opts.color.mode === HeatmapColorMode.Opacity,
    });

    builder.addRadio({
      path: `color.scale`,
      name: 'Scale',
      defaultValue: defaultPanelOptions.color.scale,
      category,
      settings: {
        options: [
          { label: 'Exponential', value: HeatmapColorScale.Exponential },
          { label: 'Linear', value: HeatmapColorScale.Linear },
        ],
      },
      showIf: (opts) => opts.color.mode === HeatmapColorMode.Opacity,
    });

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
      showIf: (opts) =>
        opts.color.mode === HeatmapColorMode.Opacity && opts.color.scale === HeatmapColorScale.Exponential,
    });

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
      showIf: (opts) => opts.color.mode !== HeatmapColorMode.Opacity,
    });

    builder
      .addSliderInput({
        path: 'color.steps',
        name: 'Steps',
        defaultValue: defaultPanelOptions.color.steps,
        category,
        settings: {
          min: 2,
          max: 128,
          step: 1,
        },
      })
      .addCustomEditor({
        id: '__scale__',
        path: `__scale__`,
        name: '',
        category,
        editor: () => {
          const palette = quantizeScheme(opts.color, config.theme2);
          return (
            <div>
              <ColorScale colorPalette={palette} min={1} max={100} />
            </div>
          );
        },
      });

    category = ['Display'];

    builder
      // .addRadio({
      //   path: 'showValue',
      //   name: 'Show values',
      //   defaultValue: defaultPanelOptions.showValue,
      //   category,
      //   settings: {
      //     options: [
      //       { value: VisibilityMode.Auto, label: 'Auto' },
      //       { value: VisibilityMode.Always, label: 'Always' },
      //       { value: VisibilityMode.Never, label: 'Never' },
      //     ],
      //   },
      // })
      .addNumberInput({
        path: 'hideThreshold',
        name: 'Hide cell counts <=',
        defaultValue: 1e-9,
        category,
      })
      .addSliderInput({
        name: 'Cell gap',
        path: 'cellGap',
        defaultValue: defaultPanelOptions.cellGap,
        category,
        settings: {
          min: 0,
          max: 25,
        },
      })
      // .addSliderInput({
      //   name: 'Cell radius',
      //   path: 'cellRadius',
      //   defaultValue: defaultPanelOptions.cellRadius,
      //   category,
      //   settings: {
      //     min: 0,
      //     max: 100,
      //   },
      // })
      // .addRadio({
      //   path: 'yAxisLabels',
      //   name: 'Axis labels',
      //   defaultValue: 'auto',
      //   category,
      //   settings: {
      //     options: [
      //       { value: 'auto', label: 'Auto' },
      //       { value: 'middle', label: 'Middle' },
      //       { value: 'bottom', label: 'Bottom' },
      //       { value: 'top', label: 'Top' },
      //     ],
      //   },
      // })
      .addBooleanSwitch({
        path: 'yAxisReverse',
        name: 'Reverse buckets',
        defaultValue: defaultPanelOptions.yAxisReverse === true,
        category,
      });

    category = ['Tooltip'];

    builder.addBooleanSwitch({
      path: 'tooltip.show',
      name: 'Show tooltip',
      defaultValue: defaultPanelOptions.tooltip.show,
      category,
    });

    builder.addBooleanSwitch({
      path: 'tooltip.yHistogram',
      name: 'Show histogram (Y axis)',
      defaultValue: defaultPanelOptions.tooltip.yHistogram,
      category,
      showIf: (opts) => opts.tooltip.show,
    });

    category = ['Legend'];
    builder.addBooleanSwitch({
      path: 'legend.show',
      name: 'Show legend',
      defaultValue: defaultPanelOptions.legend.show,
      category,
    });

    category = ['Exemplars'];
    builder.addColorPicker({
      path: 'exemplars.color',
      name: 'Color',
      defaultValue: defaultPanelOptions.exemplars.color,
      category,
    });
  })
  .setSuggestionsSupplier(new HeatmapSuggestionsSupplier());
