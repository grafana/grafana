import { DataFrame, FieldConfigProperty, FieldType, identityOverrideProcessor, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  AxisPlacement,
  GraphFieldConfig,
  ScaleDistribution,
  ScaleDistributionConfig,
  HeatmapCellLayout,
} from '@grafana/schema';
import { TooltipDisplayMode } from '@grafana/ui';
import { addHideFrom, ScaleDistributionEditor } from '@grafana/ui/internal';
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
      const category = [t('heatmap.category-heatmap', 'Heatmap')];
      builder.addCustomEditor<void, ScaleDistributionConfig>({
        id: 'scaleDistribution',
        path: 'scaleDistribution',
        name: t('heatmap.name-y-axis-scale', 'Y axis scale'),
        category,
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

    let category = [t('heatmap.category-heatmap', 'Heatmap')];

    builder.addRadio({
      path: 'calculate',
      name: t('heatmap.name-calculate-from-data', 'Calculate from data'),
      defaultValue: defaultOptions.calculate,
      category,
      settings: {
        options: [
          { label: t('heatmap.calculate-from-data-options.label-yes', 'Yes'), value: true },
          { label: t('heatmap.calculate-from-data-options.label-no', 'No'), value: false },
        ],
      },
    });

    if (opts.calculate) {
      addHeatmapCalculationOptions('calculation.', builder, opts.calculation, category);
    }

    category = [t('heatmap.category-y-axis', 'Y Axis')];

    builder
      .addRadio({
        path: 'yAxis.axisPlacement',
        name: t('heatmap.name-placement', 'Placement'),
        defaultValue: defaultOptions.yAxis.axisPlacement ?? AxisPlacement.Left,
        category,
        settings: {
          options: [
            { label: t('heatmap.placement-options.label-left', 'Left'), value: AxisPlacement.Left },
            { label: t('heatmap.placement-options.label-right', 'Right'), value: AxisPlacement.Right },
            { label: t('heatmap.placement-options.label-hidden', 'Hidden'), value: AxisPlacement.Hidden },
          ],
        },
      })
      .addUnitPicker({
        category,
        path: 'yAxis.unit',
        name: t('heatmap.name-unit', 'Unit'),
        defaultValue: undefined,
        settings: {
          isClearable: true,
        },
      })
      .addNumberInput({
        category,
        path: 'yAxis.decimals',
        name: t('heatmap.name-decimals', 'Decimals'),
        settings: {
          placeholder: t('heatmap.placeholder-decimals', 'Auto'),
        },
      });

    if (!isOrdinalY) {
      // if undefined, then show the min+max
      builder
        .addNumberInput({
          path: 'yAxis.min',
          name: t('heatmap.name-min-value', 'Min value'),
          settings: {
            placeholder: t('heatmap.placeholder-min-value', 'Auto'),
          },
          category,
        })
        .addTextInput({
          path: 'yAxis.max',
          name: t('heatmap.name-max-value', 'Max value'),
          settings: {
            placeholder: t('heatmap.placeholder-max-value', 'Auto'),
          },
          category,
        });
    }

    builder
      .addNumberInput({
        path: 'yAxis.axisWidth',
        name: t('heatmap.name-axis-width', 'Axis width'),
        defaultValue: defaultOptions.yAxis.axisWidth,
        settings: {
          placeholder: t('heatmap.placeholder-axis-width', 'Auto'),
          min: 5, // smaller should just be hidden
        },
        category,
      })
      .addTextInput({
        path: 'yAxis.axisLabel',
        name: t('heatmap.name-axis-label', 'Axis label'),
        defaultValue: defaultOptions.yAxis.axisLabel,
        settings: {
          placeholder: t('heatmap.placeholder-axis-label', 'Auto'),
        },
        category,
      });

    if (!opts.calculate) {
      builder.addRadio({
        path: 'rowsFrame.layout',
        name: t('heatmap.name-tick-alignment', 'Tick alignment'),
        defaultValue: defaultOptions.rowsFrame?.layout ?? HeatmapCellLayout.auto,
        category,
        settings: {
          options: [
            { label: t('heatmap.tick-alignment-options.label-auto', 'Auto'), value: HeatmapCellLayout.auto },
            { label: t('heatmap.tick-alignment-options.label-top', 'Top (LE)'), value: HeatmapCellLayout.le },
            { label: t('heatmap.tick-alignment-options.label-middle', 'Middle'), value: HeatmapCellLayout.unknown },
            { label: t('heatmap.tick-alignment-options.label-bottom', 'Bottom (GE)'), value: HeatmapCellLayout.ge },
          ],
        },
      });
    }
    builder.addBooleanSwitch({
      path: 'yAxis.reverse',
      name: t('heatmap.name-reverse', 'Reverse'),
      defaultValue: defaultOptions.yAxis.reverse === true,
      category,
    });

    category = [t('heatmap.category-colors', 'Colors')];

    builder.addRadio({
      path: `color.mode`,
      name: t('heatmap.name-mode', 'Mode'),
      defaultValue: defaultOptions.color.mode,
      category,
      settings: {
        options: [
          { label: t('heatmap.mode-options.label-scheme', 'Scheme'), value: HeatmapColorMode.Scheme },
          { label: t('heatmap.mode-options.label-opacity', 'Opacity'), value: HeatmapColorMode.Opacity },
        ],
      },
    });

    builder.addColorPicker({
      path: `color.fill`,
      name: t('heatmap.name-color', 'Color'),
      defaultValue: defaultOptions.color.fill,
      category,
      showIf: (opts) => opts.color.mode === HeatmapColorMode.Opacity,
    });

    builder.addRadio({
      path: `color.scale`,
      name: t('heatmap.name-scale', 'Scale'),
      defaultValue: defaultOptions.color.scale,
      category,
      settings: {
        options: [
          { label: t('heatmap.scale-options.label-exponential', 'Exponential'), value: HeatmapColorScale.Exponential },
          { label: t('heatmap.scale-options.label-linear', 'Linear'), value: HeatmapColorScale.Linear },
        ],
      },
      showIf: (opts) => opts.color.mode === HeatmapColorMode.Opacity,
    });

    builder.addSliderInput({
      path: 'color.exponent',
      name: t('heatmap.name-exponent', 'Exponent'),
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
      name: t('heatmap.name-scheme', 'Scheme'),
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
        name: t('heatmap.name-steps', 'Steps'),
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
        name: t('heatmap.name-reverse', 'Reverse'),
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
        name: t('heatmap.name-start-color-from-value', 'Start color scale from value'),
        defaultValue: defaultOptions.color.min,
        settings: {
          placeholder: t('heatmap.placeholder-start-color-from-value', 'Auto (min)'),
        },
        category,
      })
      .addNumberInput({
        path: 'color.max',
        name: t('heatmap.name-end-color-at-value', 'End color scale at value'),
        defaultValue: defaultOptions.color.max,
        settings: {
          placeholder: t('heatmap.placeholder-end-color-at-value', 'Auto (max)'),
        },
        category,
      });

    category = [t('heatmap.category-cell-display', 'Cell display')];

    if (!opts.calculate) {
      builder.addTextInput({
        path: 'rowsFrame.value',
        name: t('heatmap.name-value-name', 'Value name'),
        defaultValue: defaultOptions.rowsFrame?.value,
        settings: {
          placeholder: t('heatmap.placeholder-value-name', 'Value'),
        },
        category,
      });
    }

    builder
      .addUnitPicker({
        category,
        path: 'cellValues.unit',
        name: t('heatmap.name-unit', 'Unit'),
        defaultValue: undefined,
        settings: {
          isClearable: true,
        },
      })
      .addNumberInput({
        category,
        path: 'cellValues.decimals',
        name: t('heatmap.name-decimals', 'Decimals'),
        settings: {
          placeholder: t('heatmap.placeholder-decimals', 'Auto'),
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
        name: t('heatmap.name-cell-gap', 'Cell gap'),
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
        name: t('heatmap.name-hide-cells-lt', 'Hide cells with values <='),
        defaultValue: defaultOptions.filterValues?.le,
        settings: {
          placeholder: t('heatmap.placeholder-hide-cells-lt', 'None'),
        },
        category,
      })
      .addNumberInput({
        path: 'filterValues.ge',
        name: t('heatmap.name-hide-cells-gt', 'Hide cells with values >='),
        defaultValue: defaultOptions.filterValues?.ge,
        settings: {
          placeholder: t('heatmap.placeholder-hide-cells-gt', 'None'),
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

    category = [t('heatmap.category-tooltip', 'Tooltip')];

    builder.addRadio({
      path: 'tooltip.mode',
      name: t('heatmap.name-tooltip-mode', 'Tooltip mode'),
      category,
      defaultValue: TooltipDisplayMode.Single,
      settings: {
        options: [
          { value: TooltipDisplayMode.Single, label: t('heatmap.tooltip-mode-options.label-single', 'Single') },
          { value: TooltipDisplayMode.Multi, label: t('heatmap.tooltip-mode-options.label-all', 'All') },
          { value: TooltipDisplayMode.None, label: t('heatmap.tooltip-mode-options.label-hidden', 'Hidden') },
        ],
      },
    });

    builder.addBooleanSwitch({
      path: 'tooltip.yHistogram',
      name: t('heatmap.name-show-histogram', 'Show histogram (Y axis)'),
      defaultValue: defaultOptions.tooltip.yHistogram,
      category,
      showIf: (opts) => opts.tooltip.mode === TooltipDisplayMode.Single,
    });

    builder.addBooleanSwitch({
      path: 'tooltip.showColorScale',
      name: t('heatmap.name-show-color-scale', 'Show color scale'),
      defaultValue: defaultOptions.tooltip.showColorScale,
      category,
      showIf: (opts) => opts.tooltip.mode === TooltipDisplayMode.Single,
    });

    builder.addNumberInput({
      path: 'tooltip.maxWidth',
      name: t('heatmap.name-max-width', 'Max width'),
      category,
      settings: {
        integer: true,
      },
      showIf: (opts) => opts.tooltip.mode !== TooltipDisplayMode.None,
    });

    builder.addNumberInput({
      path: 'tooltip.maxHeight',
      name: t('heatmap.name-max-height', 'Max height'),
      category,
      defaultValue: undefined,
      settings: {
        integer: true,
      },
      showIf: (options: Options, data: DataFrame[] | undefined, annotations: DataFrame[] | undefined) =>
        options.tooltip?.mode === TooltipDisplayMode.Multi ||
        annotations?.some((df) => df.meta?.custom?.resultType === 'exemplar'),
    });

    category = [t('heatmap.category-legend', 'Legend')];
    builder.addBooleanSwitch({
      path: 'legend.show',
      name: t('heatmap.name-show-legend', 'Show legend'),
      defaultValue: defaultOptions.legend.show,
      category,
    });

    category = [t('heatmap.category-exemplars', 'Exemplars')];
    builder.addColorPicker({
      path: 'exemplars.color',
      name: t('heatmap.name-color', 'Color'),
      defaultValue: defaultOptions.exemplars.color,
      category,
      showIf: (options: Options, data: DataFrame[] | undefined, annotations: DataFrame[] | undefined) =>
        annotations?.some((df) => df.meta?.custom?.resultType === 'exemplar'),
    });
  })
  .setSuggestionsSupplier(new HeatmapSuggestionsSupplier())
  .setDataSupport({ annotations: true });
