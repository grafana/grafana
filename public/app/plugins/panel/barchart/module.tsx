import {
  DataFrame,
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  PanelPlugin,
  VizOrientation,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { GraphTransform, GraphThresholdsStyleMode, StackingMode, VisibilityMode } from '@grafana/schema';
import { getGraphFieldOptions, commonOptionsBuilder } from '@grafana/ui';
import { optsWithHideZeros } from '@grafana/ui/internal';

import { ThresholdsStyleEditor } from '../timeseries/ThresholdsStyleEditor';

import { BarChartPanel } from './BarChartPanel';
import { TickSpacingEditor } from './TickSpacingEditor';
import { changeToBarChartPanelMigrationHandler } from './migrations';
import { FieldConfig, Options, defaultFieldConfig, defaultOptions } from './panelcfg.gen';
import { BarChartSuggestionsSupplier } from './suggestions';
// import { Data } from 'ol/DataTile';

export const plugin = new PanelPlugin<Options, FieldConfig>(BarChartPanel)
  .setPanelChangeHandler(changeToBarChartPanelMigrationHandler)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
      [FieldConfigProperty.Links]: {
        settings: {
          showOneClick: true,
        },
      },
      [FieldConfigProperty.Actions]: {
        hideFromDefaults: false,
      },
    },
    useCustomConfig: (builder) => {
      const cfg = defaultFieldConfig;

      builder
        .addSliderInput({
          path: 'lineWidth',
          name: t('barchart.config.name-line-width', 'Line width'),
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: t('barchart.config.name-fill-opacity', 'Fill opacity'),
          defaultValue: cfg.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        })
        .addRadio({
          path: 'gradientMode',
          name: t('barchart.config.name-gradient-mode', 'Gradient mode'),
          defaultValue: getGraphFieldOptions().fillGradient[0].value,
          settings: {
            options: getGraphFieldOptions().fillGradient,
          },
        });

      builder.addSelect({
        category: ['Graph styles'],
        name: t('barchart.config.name-transform', 'Transform'),
        path: 'transform',
        settings: {
          options: [
            {
              label: t('barchart.config.transform-options.label-constant', 'Constant'),
              value: GraphTransform.Constant,
              description: t(
                'barchart.config.transform-options.description-constant',
                'The first value will be shown as a constant line'
              ),
            },
            {
              label: t('barchart.config.transform-options.label-negative-y', 'Negative Y'),
              value: GraphTransform.NegativeY,
              description: t(
                'barchart.config.transform-options.description-negative-y',
                'Flip the results to negative values on the y axis'
              ),
            },
          ],
          isClearable: true,
        },
        hideFromDefaults: true,
      });

      builder.addCustomEditor({
        id: 'thresholdsStyle',
        path: 'thresholdsStyle',
        name: t('barchart.config.name-show-thresholds', 'Show thresholds'),
        category: [t('barchart.config.category-thresholds', 'Thresholds')],
        defaultValue: { mode: GraphThresholdsStyleMode.Off },
        settings: {
          options: getGraphFieldOptions().thresholdsDisplayModes,
        },
        editor: ThresholdsStyleEditor,
        override: ThresholdsStyleEditor,
        process: identityOverrideProcessor,
        shouldApply: () => true,
      });

      commonOptionsBuilder.addAxisConfig(builder, cfg);
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addFieldNamePicker({
        path: 'xField',
        name: t('barchart.config.name-x-axis', 'X Axis'),
        settings: {
          placeholderText: t('barchart.config.placeholder-x-axis', 'First string or time field'),
        },
      })
      .addRadio({
        path: 'orientation',
        name: t('barchart.config.name-orientation', 'Orientation'),
        settings: {
          options: [
            { value: VizOrientation.Auto, label: t('barchart.config.orientation-options.label-auto', 'Auto') },
            {
              value: VizOrientation.Horizontal,
              label: t('barchart.config.orientation-options.label-horizontal', 'Horizontal'),
            },
            {
              value: VizOrientation.Vertical,
              label: t('barchart.config.orientation-options.label-line-vertical', 'Vertical'),
            },
          ],
        },
        defaultValue: defaultOptions.orientation,
      })
      .addSliderInput({
        path: 'xTickLabelRotation',
        name: t('barchart.config.name-rotate-x-labels', 'Rotate x-axis tick labels'),
        defaultValue: defaultOptions.xTickLabelRotation,
        settings: {
          min: -90,
          max: 90,
          step: 15,
          marks: { '-90': '-90°', '-45': '-45°', 0: '0°', 45: '45°', 90: '90°' },
          included: false,
        },
      })
      .addNumberInput({
        path: 'xTickLabelMaxLength',
        name: t('barchart.config.name-x-label-max-length', 'X-axis tick label max length'),
        description: t(
          'barchart.config.description-x-label-max-length',
          'X-axis labels will be truncated to the length provided'
        ),
        settings: {
          placeholder: t('barchart.config.placeholder-x-label-max-length', 'None'),
          min: 0,
        },
        showIf: (opts) => opts.xTickLabelRotation !== 0,
      })
      .addCustomEditor({
        id: 'xTickLabelSpacing',
        path: 'xTickLabelSpacing',
        name: t('barchart.config.name-x-label-min-spacing', 'X-axis labels minimum spacing'),
        defaultValue: defaultOptions.xTickLabelSpacing,
        editor: TickSpacingEditor,
      })
      .addRadio({
        path: 'showValue',
        name: t('barchart.config.name-show-values', 'Show values'),
        settings: {
          options: [
            { value: VisibilityMode.Auto, label: t('barchart.config.show-values-options.label-auto', 'Auto') },
            { value: VisibilityMode.Always, label: t('barchart.config.show-values-options.label-always', 'Always') },
            { value: VisibilityMode.Never, label: t('barchart.config.show-values-options.label-never', 'Never') },
          ],
        },
        defaultValue: defaultOptions.showValue,
      })
      .addRadio({
        path: 'stacking',
        name: t('barchart.config.name-stacking', 'Stacking'),
        settings: {
          options: getGraphFieldOptions().stacking,
        },
        defaultValue: defaultOptions.stacking,
      })
      .addFieldNamePicker({ // added 
        path: 'groupByField',
        name: 'Group by',
        description: 'Select field to group bars by',
        defaultValue: '',
      })
      .addSliderInput({
        path: 'clusterWidth',
        name: 'Cluster width',
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      })
      .addSliderInput({
        path: 'groupWidth',
        name: t('barchart.config.name-group-width', 'Group width'),
        defaultValue: defaultOptions.groupWidth,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
        showIf: (c, data) => {
          if (c.stacking && c.stacking !== StackingMode.None) {
            return false;
          }
          return countNumberFields(data) !== 1;
        },
      })
      .addSliderInput({
        path: 'barWidth',
        name: t('barchart.config.name-bar-width', 'Bar width'),
        defaultValue: defaultOptions.barWidth,
        settings: {
          min: 0,
          max: 2,
          step: 0.01,
        },
      })
      .addSliderInput({
        path: 'barRadius',
        name: t('barchart.config.name-bar-radius', 'Bar radius'),
        defaultValue: defaultOptions.barRadius,
        settings: {
          min: 0,
          max: 0.5,
          step: 0.05,
        },
      })
      .addBooleanSwitch({
        path: 'fullHighlight',
        name: t('barchart.config.name-full-highlight', 'Highlight full area on hover'),
        defaultValue: defaultOptions.fullHighlight,
        showIf: (c) => c.stacking === StackingMode.None,
      });

    builder.addFieldNamePicker({
      path: 'colorByField',
      name: t('barchart.config.name-color-by-field', 'Color by field'),
      description: t(
        'barchart.config.description-color-by-field',
        'Use the color value for a sibling field to color each bar value.'
      ),
    });

    commonOptionsBuilder.addTooltipOptions(builder, false, false, optsWithHideZeros);
    commonOptionsBuilder.addLegendOptions(builder);
    commonOptionsBuilder.addTextSizeOptions(builder, false);
  })
  .setSuggestionsSupplier(new BarChartSuggestionsSupplier());

function countNumberFields(data?: DataFrame[]): number {
  let count = 0;
  if (data) {
    for (const frame of data) {
      for (const field of frame.fields) {
        if (field.type === FieldType.number) {
          count++;
        }
      }
    }
  }
  return count;
}
