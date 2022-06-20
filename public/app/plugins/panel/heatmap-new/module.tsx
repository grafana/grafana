import React from 'react';

import { FieldConfigProperty, FieldType, identityOverrideProcessor, PanelData, PanelPlugin } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AxisPlacement, GraphFieldConfig, ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';
import { addHideFrom, ScaleDistributionEditor } from '@grafana/ui/src/options/builder';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { addHeatmapCalculationOptions } from 'app/features/transformers/calculateHeatmap/editor/helper';
import { readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { HeatmapCellLayout } from 'app/features/transformers/calculateHeatmap/models.gen';

import { HeatmapPanel } from './HeatmapPanel';
import { prepareHeatmapData } from './fields';
import { heatmapChangedHandler, heatmapMigrationHandler } from './migrations';
import { PanelOptions, defaultPanelOptions, HeatmapColorMode, HeatmapColorScale } from './models.gen';
import { colorSchemes, quantizeScheme } from './palettes';
import { HeatmapSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<PanelOptions, GraphFieldConfig>(HeatmapPanel)
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => v !== FieldConfigProperty.Links),
    useCustomConfig: (builder) => {
      builder.addCustomEditor<void, ScaleDistributionConfig>({
        id: 'scaleDistribution',
        path: 'scaleDistribution',
        name: 'Y axis scale',
        category: ['Heatmap'],
        editor: ScaleDistributionEditor as any,
        override: ScaleDistributionEditor as any,
        defaultValue: { type: ScaleDistribution.Linear },
        shouldApply: (f) => f.type === FieldType.number,
        process: identityOverrideProcessor,
        hideFromDefaults: true,
      });
      addHideFrom(builder); // for tooltip etc
    },
  })
  .setPanelChangeHandler(heatmapChangedHandler)
  .setMigrationHandler(heatmapMigrationHandler)
  .setPanelOptions((builder, context) => {
    const opts = context.options ?? defaultPanelOptions;

    let isOrdinalY = false;

    try {
      const v = prepareHeatmapData({ series: context.data } as PanelData, opts, config.theme2);
      isOrdinalY = readHeatmapRowsCustomMeta(v.heatmap).yOrdinalDisplay != null;
    } catch {}

    let category = ['Heatmap'];

    builder.addRadio({
      path: 'calculate',
      name: 'Calculate from data',
      defaultValue: defaultPanelOptions.calculate,
      category,
      settings: {
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      },
    });

    if (opts.calculate) {
      addHeatmapCalculationOptions('calculation.', builder, opts.calculation, category);
    }

    category = ['Y Axis'];

    builder.addRadio({
      path: 'yAxis.axisPlacement',
      name: 'Placement',
      defaultValue: defaultPanelOptions.yAxis.axisPlacement ?? AxisPlacement.Left,
      category,
      settings: {
        options: [
          { label: 'Left', value: AxisPlacement.Left },
          { label: 'Right', value: AxisPlacement.Right },
          { label: 'Hidden', value: AxisPlacement.Hidden },
        ],
      },
    });

    builder
      .addUnitPicker({
        category,
        path: 'yAxis.unit',
        name: 'Unit',
        defaultValue: undefined,
      })
      .addNumberInput({
        category,
        path: 'yAxis.decimals',
        name: 'Decimals',
        settings: {
          placeholder: 'Auto',
        },
      });

    if (!isOrdinalY) {
      // if undefined, then show the min+max
      builder
        .addNumberInput({
          path: 'yAxis.min',
          name: 'Min value',
          settings: {
            placeholder: 'Auto',
          },
          category,
        })
        .addTextInput({
          path: 'yAxis.max',
          name: 'Max value',
          settings: {
            placeholder: 'Auto',
          },
          category,
        });
    }

    builder
      .addNumberInput({
        path: 'yAxis.axisWidth',
        name: 'Axis width',
        defaultValue: defaultPanelOptions.yAxis.axisWidth,
        settings: {
          placeholder: 'Auto',
          min: 5, // smaller should just be hidden
        },
        category,
      })
      .addTextInput({
        path: 'yAxis.axisLabel',
        name: 'Axis label',
        defaultValue: defaultPanelOptions.yAxis.axisLabel,
        settings: {
          placeholder: 'Auto',
        },
        category,
      });

    if (!opts.calculate) {
      builder.addRadio({
        path: 'rowsFrame.layout',
        name: 'Tick alignment',
        defaultValue: defaultPanelOptions.rowsFrame?.layout ?? HeatmapCellLayout.auto,
        category,
        settings: {
          options: [
            { label: 'Auto', value: HeatmapCellLayout.auto },
            { label: 'Top (LE)', value: HeatmapCellLayout.le },
            { label: 'Middle', value: HeatmapCellLayout.unknown },
            { label: 'Bottom (GE)', value: HeatmapCellLayout.ge },
          ],
        },
      });
    }
    builder.addBooleanSwitch({
      path: 'yAxis.reverse',
      name: 'Reverse',
      defaultValue: defaultPanelOptions.yAxis.reverse === true,
      category,
    });

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

    builder
      .addNumberInput({
        path: 'color.min',
        name: 'Start color scale from value',
        defaultValue: defaultPanelOptions.color.min,
        settings: {
          placeholder: 'Auto (min)',
        },
        category,
      })
      .addNumberInput({
        path: 'color.max',
        name: 'End color scale at value',
        defaultValue: defaultPanelOptions.color.max,
        settings: {
          placeholder: 'Auto (max)',
        },
        category,
      });

    category = ['Cell display'];

    if (!opts.calculate) {
      builder.addTextInput({
        path: 'rowsFrame.value',
        name: 'Value name',
        defaultValue: defaultPanelOptions.rowsFrame?.value,
        settings: {
          placeholder: 'Value',
        },
        category,
      });
    }

    builder
      .addUnitPicker({
        category,
        path: 'cellValues.unit',
        name: 'Unit',
        defaultValue: undefined,
      })
      .addNumberInput({
        category,
        path: 'cellValues.decimals',
        name: 'Decimals',
        settings: {
          placeholder: 'Auto',
        },
      });

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
      .addNumberInput({
        path: 'filterValues.le',
        name: 'Hide cells with values <=',
        defaultValue: defaultPanelOptions.filterValues?.le,
        settings: {
          placeholder: 'None',
        },
        category,
      })
      .addNumberInput({
        path: 'filterValues.ge',
        name: 'Hide cells with values >=',
        defaultValue: defaultPanelOptions.filterValues?.ge,
        settings: {
          placeholder: 'None',
        },
        category,
      });
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
