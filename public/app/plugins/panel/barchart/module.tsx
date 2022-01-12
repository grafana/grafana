import {
  DataFrame,
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  getFieldDisplayName,
  PanelPlugin,
  VizOrientation,
} from '@grafana/data';
import { BarChartPanel } from './BarChartPanel';
import { StackingMode, VisibilityMode } from '@grafana/schema';
import { graphFieldOptions, commonOptionsBuilder } from '@grafana/ui';
import { BarChartFieldConfig, PanelOptions, defaultBarChartFieldConfig, defaultPanelOptions } from './models.gen';
import { BarChartSuggestionsSupplier } from './suggestions';
import { prepareBarChartDisplayValues } from './utils';
import { config } from '@grafana/runtime';
import { TickSpacingEditor } from './TickSpacingEditor';

export const plugin = new PanelPlugin<PanelOptions, BarChartFieldConfig>(BarChartPanel)
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
      const cfg = defaultBarChartFieldConfig;

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

      commonOptionsBuilder.addAxisConfig(builder, cfg, false);
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder, context) => {
    const disp = prepareBarChartDisplayValues(context.data, config.theme2, context.options ?? ({} as any));
    let xaxisPlaceholder = 'First string or time field';
    if (disp.viz?.fields?.length) {
      const first = disp.viz.fields[0];
      xaxisPlaceholder += ` (${getFieldDisplayName(first, disp.viz)})`;
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
        defaultValue: defaultPanelOptions.orientation,
      })
      .addSliderInput({
        path: 'xTickLabelRotation',
        name: 'Rotate bar labels',
        defaultValue: defaultPanelOptions.xTickLabelRotation,
        settings: {
          min: -90,
          max: 90,
          step: 15,
          marks: { '-90': '-90°', '-45': '-45°', 0: '0°', 45: '45°', 90: '90°' },
          included: false,
        },
        showIf: (opts) => {
          return opts.orientation === VizOrientation.Auto || opts.orientation === VizOrientation.Vertical;
        },
      })
      .addNumberInput({
        path: 'xTickLabelMaxLength',
        name: 'Bar label max length',
        description: 'Bar labels will be truncated to the length provided',
        settings: {
          placeholder: 'None',
          min: 0,
        },
      })
      .addCustomEditor({
        id: 'xTickLabelSpacing',
        path: 'xTickLabelSpacing',
        name: 'Bar labels minimum spacing',
        defaultValue: defaultPanelOptions.xTickLabelSpacing,
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
        defaultValue: defaultPanelOptions.showValue,
      })
      .addRadio({
        path: 'stacking',
        name: 'Stacking',
        settings: {
          options: graphFieldOptions.stacking,
        },
        defaultValue: defaultPanelOptions.stacking,
      })
      .addSliderInput({
        path: 'groupWidth',
        name: 'Group width',
        defaultValue: defaultPanelOptions.groupWidth,
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
        defaultValue: defaultPanelOptions.barWidth,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      })
      .addSliderInput({
        path: 'barRadius',
        name: 'Bar radius',
        defaultValue: defaultPanelOptions.barRadius,
        settings: {
          min: 0,
          max: 0.5,
          step: 0.05,
        },
      });

    builder.addFieldNamePicker({
      path: 'colorByField',
      name: 'Color by field',
      description: 'Use the color value for a sibling field to color each bar value.',
    });

    commonOptionsBuilder.addTooltipOptions(builder);
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
