import { DataFrame, FieldConfigProperty, FieldType, identityOverrideProcessor, PanelPlugin } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  AxisPlacement,
  GraphFieldConfig,
  ScaleDistribution,
  ScaleDistributionConfig,
  HeatmapCellLayout,
} from '@grafana/schema';
import { TooltipDisplayMode } from '@grafana/ui';
import { addHideFrom, ScaleDistributionEditor } from '@grafana/ui/src/options/builder';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { addHeatmapCalculationOptions } from 'app/features/transformers/calculateHeatmap/editor/helper';
import { readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';

import { HeatmapPanel } from './HeatmapPanel';
import { prepareHeatmapData } from './fields';
import { heatmapChangedHandler, heatmapMigrationHandler } from './migrations';
import { colorSchemes, quantizeScheme } from './palettes';
import { HeatmapSuggestionsSupplier } from './suggestions';
import { Options, defaultOptions, HeatmapColorMode, HeatmapColorScale } from './types';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(HeatmapPanel)
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => v !== FieldConfigProperty.Links),
    standardOptions: {
      [FieldConfigProperty.Links]: {
        settings: {
          showOneClick: true,
        },
      },
    },
    useCustomConfig: (builder) => {
      builder.addCustomEditor<void, ScaleDistributionConfig>({
        id: 'scaleDistribution',
        path: 'scaleDistribution',
        name: 'Y axis scale',
        category: ['Heatmap'],
        editor: ScaleDistributionEditor,
        override: ScaleDistributionEditor,
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
    const opts = context.options ?? defaultOptions;

    let isOrdinalY = false;

    if (context.data.length > 0) {
      try {
        // NOTE: this feels like overkill/expensive just to assert if we have an ordinal y
        // can probably simplify without doing full dataprep
        const palette = quantizeScheme(opts.color, config.theme2);
        const v = prepareHeatmapData({
          frames: context.data,
          options: opts,
          palette,
          theme: config.theme2,
        });
        isOrdinalY = readHeatmapRowsCustomMeta(v.heatmap).yOrdinalDisplay != null;
      } catch {}
    }

    let category = ['Heatmap'];

    builder.addRadio({
      path: 'calculate',
      name: 'Calculate from data',
      defaultValue: defaultOptions.calculate,
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

    builder
      .addRadio({
        path: 'yAxis.axisPlacement',
        name: 'Placement',
        defaultValue: defaultOptions.yAxis.axisPlacement ?? AxisPlacement.Left,
        category,
        settings: {
          options: [
            { label: 'Left', value: AxisPlacement.Left },
            { label: 'Right', value: AxisPlacement.Right },
            { label: 'Hidden', value: AxisPlacement.Hidden },
          ],
        },
      })
      .addUnitPicker({
        category,
        path: 'yAxis.unit',
        name: 'Unit',
        defaultValue: undefined,
        settings: {
          isClearable: true,
        },
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
        defaultValue: defaultOptions.yAxis.axisWidth,
        settings: {
          placeholder: 'Auto',
          min: 5, // smaller should just be hidden
        },
        category,
      })
      .addTextInput({
        path: 'yAxis.axisLabel',
        name: 'Axis label',
        defaultValue: defaultOptions.yAxis.axisLabel,
        settings: {
          placeholder: 'Auto',
        },
        category,
      });

    if (!opts.calculate) {
      builder.addRadio({
        path: 'rowsFrame.layout',
        name: 'Tick alignment',
        defaultValue: defaultOptions.rowsFrame?.layout ?? HeatmapCellLayout.auto,
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
      defaultValue: defaultOptions.yAxis.reverse === true,
      category,
    });

    category = ['Colors'];

    builder.addRadio({
      path: `color.mode`,
      name: 'Mode',
      defaultValue: defaultOptions.color.mode,
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
      defaultValue: defaultOptions.color.fill,
      category,
      showIf: (opts) => opts.color.mode === HeatmapColorMode.Opacity,
    });

    builder.addRadio({
      path: `color.scale`,
      name: 'Scale',
      defaultValue: defaultOptions.color.scale,
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
      defaultValue: defaultOptions.color.exponent,
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
      defaultValue: defaultOptions.color.scheme,
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
        defaultValue: defaultOptions.color.steps,
        category,
        settings: {
          min: 2,
          max: 128,
          step: 1,
        },
      })
      .addBooleanSwitch({
        path: 'color.reverse',
        name: 'Reverse',
        defaultValue: defaultOptions.color.reverse,
        category,
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
        defaultValue: defaultOptions.color.min,
        settings: {
          placeholder: 'Auto (min)',
        },
        category,
      })
      .addNumberInput({
        path: 'color.max',
        name: 'End color scale at value',
        defaultValue: defaultOptions.color.max,
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
        defaultValue: defaultOptions.rowsFrame?.value,
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
        settings: {
          isClearable: true,
        },
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
      //   defaultValue: defaultOptions.showValue,
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
        defaultValue: defaultOptions.cellGap,
        category,
        settings: {
          min: 0,
          max: 25,
        },
      })
      .addNumberInput({
        path: 'filterValues.le',
        name: 'Hide cells with values <=',
        defaultValue: defaultOptions.filterValues?.le,
        settings: {
          placeholder: 'None',
        },
        category,
      })
      .addNumberInput({
        path: 'filterValues.ge',
        name: 'Hide cells with values >=',
        defaultValue: defaultOptions.filterValues?.ge,
        settings: {
          placeholder: 'None',
        },
        category,
      });
    // .addSliderInput({
    //   name: 'Cell radius',
    //   path: 'cellRadius',
    //   defaultValue: defaultOptions.cellRadius,
    //   category,
    //   settings: {
    //     min: 0,
    //     max: 100,
    //   },
    // })

    category = ['Tooltip'];

    builder.addRadio({
      path: 'tooltip.mode',
      name: 'Tooltip mode',
      category,
      defaultValue: TooltipDisplayMode.Single,
      settings: {
        options: [
          { value: TooltipDisplayMode.Single, label: 'Single' },
          { value: TooltipDisplayMode.Multi, label: 'All' },
          { value: TooltipDisplayMode.None, label: 'Hidden' },
        ],
      },
    });

    builder.addBooleanSwitch({
      path: 'tooltip.yHistogram',
      name: 'Show histogram (Y axis)',
      defaultValue: defaultOptions.tooltip.yHistogram,
      category,
      showIf: (opts) => opts.tooltip.mode === TooltipDisplayMode.Single,
    });

    builder.addBooleanSwitch({
      path: 'tooltip.showColorScale',
      name: 'Show color scale',
      defaultValue: defaultOptions.tooltip.showColorScale,
      category,
      showIf: (opts) => opts.tooltip.mode === TooltipDisplayMode.Single,
    });

    builder.addNumberInput({
      path: 'tooltip.maxWidth',
      name: 'Max width',
      category,
      settings: {
        integer: true,
      },
      showIf: (opts) => opts.tooltip.mode !== TooltipDisplayMode.None,
    });

    builder.addNumberInput({
      path: 'tooltip.maxHeight',
      name: 'Max height',
      category,
      defaultValue: undefined,
      settings: {
        integer: true,
      },
      showIf: (options: Options, data: DataFrame[] | undefined, annotations: DataFrame[] | undefined) =>
        options.tooltip?.mode === TooltipDisplayMode.Multi ||
        annotations?.some((df) => df.meta?.custom?.resultType === 'exemplar'),
    });

    category = ['Legend'];
    builder.addBooleanSwitch({
      path: 'legend.show',
      name: 'Show legend',
      defaultValue: defaultOptions.legend.show,
      category,
    });

    category = ['Exemplars'];
    builder.addColorPicker({
      path: 'exemplars.color',
      name: 'Color',
      defaultValue: defaultOptions.exemplars.color,
      category,
      showIf: (options: Options, data: DataFrame[] | undefined, annotations: DataFrame[] | undefined) =>
        annotations?.some((df) => df.meta?.custom?.resultType === 'exemplar'),
    });
  })
  .setSuggestionsSupplier(new HeatmapSuggestionsSupplier())
  .setDataSupport({ annotations: true });
