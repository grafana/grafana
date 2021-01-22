import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  SetFieldConfigOptionsArgs,
  stringOverrideProcessor,
} from '@grafana/data';
import {
  AxisPlacement,
  DrawStyle,
  GraphFieldConfig,
  graphFieldOptions,
  LineInterpolation,
  LineStyle,
  PointVisibility,
  ScaleDistribution,
  ScaleDistributionConfig,
  GraphGradientMode,
} from '@grafana/ui';
import { SeriesConfigEditor } from './HideSeriesConfigEditor';
import { ScaleDistributionEditor } from './ScaleDistributionEditor';
import { LineStyleEditor } from './LineStyleEditor';
import { FillBellowToEditor } from './FillBelowToEditor';

export const defaultGraphConfig: GraphFieldConfig = {
  drawStyle: DrawStyle.Line,
  lineInterpolation: LineInterpolation.Linear,
  lineWidth: 1,
  fillOpacity: 0,
  gradientMode: GraphGradientMode.None,
};

export function getGraphFieldConfig(cfg: GraphFieldConfig): SetFieldConfigOptionsArgs<GraphFieldConfig> {
  return {
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: false,
          bySeriesSupport: true,
          preferThresholdsMode: false,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
      },
    },
    useCustomConfig: (builder) => {
      builder
        .addRadio({
          path: 'drawStyle',
          name: 'Style',
          defaultValue: cfg.drawStyle,
          settings: {
            options: graphFieldOptions.drawStyle,
          },
        })
        .addRadio({
          path: 'lineInterpolation',
          name: 'Line interpolation',
          defaultValue: cfg.lineInterpolation,
          settings: {
            options: graphFieldOptions.lineInterpolation,
          },
          showIf: (c) => c.drawStyle === DrawStyle.Line,
        })
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
          showIf: (c) => c.drawStyle !== DrawStyle.Points,
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
          showIf: (c) => c.drawStyle !== DrawStyle.Points,
        })
        .addRadio({
          path: 'gradientMode',
          name: 'Gradient mode',
          defaultValue: graphFieldOptions.fillGradient[0].value,
          settings: {
            options: graphFieldOptions.fillGradient,
          },
          showIf: (c) => c.drawStyle !== DrawStyle.Points,
        })
        .addCustomEditor({
          id: 'fillBelowTo',
          path: 'fillBelowTo',
          name: 'Fill below to',
          editor: FillBellowToEditor,
          override: FillBellowToEditor,
          process: stringOverrideProcessor,
          hideFromDefaults: true,
          shouldApply: (f) => true,
        })
        .addCustomEditor<void, LineStyle>({
          id: 'lineStyle',
          path: 'lineStyle',
          name: 'Line style',
          showIf: (c) => c.drawStyle === DrawStyle.Line,
          editor: LineStyleEditor,
          override: LineStyleEditor,
          process: identityOverrideProcessor,
          shouldApply: (f) => f.type === FieldType.number,
        })
        .addRadio({
          path: 'spanNulls',
          name: 'Null values',
          defaultValue: false,
          settings: {
            options: [
              { label: 'Gaps', value: false },
              { label: 'Connected', value: true },
            ],
          },
          showIf: (c) => c.drawStyle === DrawStyle.Line,
        })
        .addRadio({
          path: 'showPoints',
          name: 'Show points',
          defaultValue: graphFieldOptions.showPoints[0].value,
          settings: {
            options: graphFieldOptions.showPoints,
          },
          showIf: (c) => c.drawStyle !== DrawStyle.Points,
        })
        .addSliderInput({
          path: 'pointSize',
          name: 'Point size',
          defaultValue: 5,
          settings: {
            min: 1,
            max: 40,
            step: 1,
          },
          showIf: (c) => c.showPoints !== PointVisibility.Never || c.drawStyle === DrawStyle.Points,
        })
        .addRadio({
          path: 'axisPlacement',
          name: 'Placement',
          category: ['Axis'],
          defaultValue: graphFieldOptions.axisPlacement[0].value,
          settings: {
            options: graphFieldOptions.axisPlacement,
          },
        })
        .addTextInput({
          path: 'axisLabel',
          name: 'Label',
          category: ['Axis'],
          defaultValue: '',
          settings: {
            placeholder: 'Optional text',
          },
          showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
          // no matter what the field type is
          shouldApply: () => true,
        })
        .addNumberInput({
          path: 'axisWidth',
          name: 'Width',
          category: ['Axis'],
          settings: {
            placeholder: 'Auto',
          },
          showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
        })
        .addNumberInput({
          path: 'axisSoftMin',
          name: 'Soft min',
          category: ['Axis'],
          settings: {
            placeholder: 'See: Standard options > Min',
          },
        })
        .addNumberInput({
          path: 'axisSoftMax',
          name: 'Soft max',
          category: ['Axis'],
          settings: {
            placeholder: 'See: Standard options > Max',
          },
        })
        .addCustomEditor<void, ScaleDistributionConfig>({
          id: 'scaleDistribution',
          path: 'scaleDistribution',
          name: 'Scale',
          category: ['Axis'],
          editor: ScaleDistributionEditor,
          override: ScaleDistributionEditor,
          defaultValue: { type: ScaleDistribution.Linear },
          shouldApply: (f) => f.type === FieldType.number,
          process: identityOverrideProcessor,
        })
        .addCustomEditor({
          id: 'hideFrom',
          name: 'Hide in area',
          category: ['Series'],
          path: 'hideFrom',
          defaultValue: {
            tooltip: false,
            graph: false,
            legend: false,
          },
          editor: SeriesConfigEditor,
          override: SeriesConfigEditor,
          shouldApply: () => true,
          hideFromDefaults: true,
          hideFromOverrides: true,
          process: (value) => value,
        });
    },
  };
}
