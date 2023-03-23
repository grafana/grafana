import {
  DataFrame,
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  getFieldDisplayName,
  identityOverrideProcessor,
  PanelPlugin,
  VizOrientation,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { GraphTransform, GraphTresholdsStyleMode, StackingMode, VisibilityMode } from '@grafana/schema';
import { graphFieldOptions, commonOptionsBuilder } from '@grafana/ui';

import { ThresholdsStyleEditor } from '../timeseries/ThresholdsStyleEditor';

import { BarChartPanel } from './BarChartPanel';
import { TickSpacingEditor } from './TickSpacingEditor';
import { FieldConfig, Options, defaultFieldConfig, defaultOptions } from './panelcfg.gen';
import { BarChartSuggestionsSupplier } from './suggestions';
import { prepareBarChartDisplayValues } from './utils';

export const plugin = new PanelPlugin<Options, FieldConfig>(BarChartPanel)
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
    },
    useCustomConfig: (builder) => {
      const cfg = defaultFieldConfig;

      builder
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          defaultValue: cfg.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        })
        .addRadio({
          path: 'gradientMode',
          name: 'Gradient mode',
          defaultValue: graphFieldOptions.fillGradient[0].value,
          settings: {
            options: graphFieldOptions.fillGradient,
          },
        });

      builder.addSelect({
        category: ['Graph styles'],
        name: 'Transform',
        path: 'transform',
        settings: {
          options: [
            {
              label: 'Constant',
              value: GraphTransform.Constant,
              description: 'The first value will be shown as a constant line',
            },
            {
              label: 'Negative Y',
              value: GraphTransform.NegativeY,
              description: 'Flip the results to negative values on the y axis',
            },
          ],
          isClearable: true,
        },
        hideFromDefaults: true,
      });

      builder.addCustomEditor({
        id: 'thresholdsStyle',
        path: 'thresholdsStyle',
        name: 'Show thresholds',
        category: ['Thresholds'],
        defaultValue: { mode: GraphTresholdsStyleMode.Off },
        settings: {
          options: graphFieldOptions.thresholdsDisplayModes,
        },
        editor: ThresholdsStyleEditor,
        override: ThresholdsStyleEditor,
        process: identityOverrideProcessor,
        shouldApply: () => true,
      });

      commonOptionsBuilder.addAxisConfig(builder, cfg, false);
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder, context) => {
    const disp = prepareBarChartDisplayValues(context.data, config.theme2, context.options ?? ({} as Options));
    let xaxisPlaceholder = 'First string or time field';
    const viz = 'viz' in disp ? disp.viz[0] : undefined;
    if (viz?.fields?.length) {
      const first = viz.fields[0];
      xaxisPlaceholder += ` (${getFieldDisplayName(first, viz)})`;
    }

    builder
      .addFieldNamePicker({
        path: 'xField',
        name: 'X Axis',
        settings: {
          placeholderText: xaxisPlaceholder,
        },
      })
      .addRadio({
        path: 'orientation',
        name: 'Orientation',
        settings: {
          options: [
            { value: VizOrientation.Auto, label: 'Auto' },
            { value: VizOrientation.Horizontal, label: 'Horizontal' },
            { value: VizOrientation.Vertical, label: 'Vertical' },
          ],
        },
        defaultValue: defaultOptions.orientation,
      })
      .addSliderInput({
        path: 'xTickLabelRotation',
        name: 'Rotate x-axis tick labels',
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
        name: 'X-axis tick label max length',
        description: 'X-axis labels will be truncated to the length provided',
        settings: {
          placeholder: 'None',
          min: 0,
        },
        showIf: (opts) => opts.xTickLabelRotation !== 0,
      })
      .addCustomEditor({
        id: 'xTickLabelSpacing',
        path: 'xTickLabelSpacing',
        name: 'X-axis labels minimum spacing',
        defaultValue: defaultOptions.xTickLabelSpacing,
        editor: TickSpacingEditor,
      })
      .addRadio({
        path: 'showValue',
        name: 'Show values',
        settings: {
          options: [
            { value: VisibilityMode.Auto, label: 'Auto' },
            { value: VisibilityMode.Always, label: 'Always' },
            { value: VisibilityMode.Never, label: 'Never' },
          ],
        },
        defaultValue: defaultOptions.showValue,
      })
      .addRadio({
        path: 'stacking',
        name: 'Stacking',
        settings: {
          options: graphFieldOptions.stacking,
        },
        defaultValue: defaultOptions.stacking,
      })
      .addSliderInput({
        path: 'groupWidth',
        name: 'Group width',
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
        name: 'Bar width',
        defaultValue: defaultOptions.barWidth,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      })
      .addSliderInput({
        path: 'barRadius',
        name: 'Bar radius',
        defaultValue: defaultOptions.barRadius,
        settings: {
          min: 0,
          max: 0.5,
          step: 0.05,
        },
      })
      .addBooleanSwitch({
        path: 'fullHighlight',
        name: 'Highlight full area on hover',
        defaultValue: defaultOptions.fullHighlight,
      });

    builder.addFieldNamePicker({
      path: 'colorByField',
      name: 'Color by field',
      description: 'Use the color value for a sibling field to color each bar value.',
    });

    if (!context.options?.fullHighlight || context.options?.stacking === StackingMode.None) {
      commonOptionsBuilder.addTooltipOptions(builder);
    }

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
