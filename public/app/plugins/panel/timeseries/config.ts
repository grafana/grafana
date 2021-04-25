import {
  FieldColorModeId,
  FieldConfigEditorBuilder,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  PanelOptionsEditorBuilder,
  SetFieldConfigOptionsArgs,
  standardEditorsRegistry,
  StatsPickerConfigSettings,
  stringOverrideProcessor,
} from '@grafana/data';
import {
  AxisConfig,
  AxisPlacement,
  BarAlignment,
  DrawStyle,
  GraphFieldConfig,
  graphFieldOptions,
  GraphGradientMode,
  HideableFieldConfig,
  LegendDisplayMode,
  LineInterpolation,
  LineStyle,
  PointVisibility,
  ScaleDistribution,
  ScaleDistributionConfig,
  StackingConfig,
  StackingMode,
} from '@grafana/ui';
import { SeriesConfigEditor } from './HideSeriesConfigEditor';
import { ScaleDistributionEditor } from './ScaleDistributionEditor';
import { LineStyleEditor } from './LineStyleEditor';
import { FillBellowToEditor } from './FillBelowToEditor';
import { OptionsWithLegend } from './types';
import { SpanNullsEditor } from './SpanNullsEditor';
import { StackingEditor } from './StackingEditor';

export const defaultGraphConfig: GraphFieldConfig = {
  drawStyle: DrawStyle.Line,
  lineInterpolation: LineInterpolation.Linear,
  lineWidth: 1,
  fillOpacity: 0,
  gradientMode: GraphGradientMode.None,
  barAlignment: BarAlignment.Center,
  stacking: {
    mode: StackingMode.None,
    group: 'A',
  },
};

const categoryStyles = ['Graph styles'];

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
          category: categoryStyles,
          defaultValue: cfg.drawStyle,
          settings: {
            options: graphFieldOptions.drawStyle,
          },
        })
        .addRadio({
          path: 'lineInterpolation',
          name: 'Line interpolation',
          category: categoryStyles,
          defaultValue: cfg.lineInterpolation,
          settings: {
            options: graphFieldOptions.lineInterpolation,
          },
          showIf: (c) => c.drawStyle === DrawStyle.Line,
        })
        .addRadio({
          path: 'barAlignment',
          name: 'Bar alignment',
          category: categoryStyles,
          defaultValue: cfg.barAlignment,
          settings: {
            options: graphFieldOptions.barAlignment,
          },
          showIf: (c) => c.drawStyle === DrawStyle.Bars,
        })
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          category: categoryStyles,
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
          category: categoryStyles,
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
          category: categoryStyles,
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
          category: categoryStyles,
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
          category: categoryStyles,
          showIf: (c) => c.drawStyle === DrawStyle.Line,
          editor: LineStyleEditor,
          override: LineStyleEditor,
          process: identityOverrideProcessor,
          shouldApply: (f) => f.type === FieldType.number,
        })
        .addCustomEditor<void, boolean>({
          id: 'spanNulls',
          path: 'spanNulls',
          name: 'Connect null values',
          category: categoryStyles,
          defaultValue: false,
          editor: SpanNullsEditor,
          override: SpanNullsEditor,
          showIf: (c) => c.drawStyle === DrawStyle.Line,
          shouldApply: (f) => f.type !== FieldType.time,
          process: identityOverrideProcessor,
        })
        .addRadio({
          path: 'showPoints',
          name: 'Show points',
          category: categoryStyles,
          defaultValue: graphFieldOptions.showPoints[0].value,
          settings: {
            options: graphFieldOptions.showPoints,
          },
          showIf: (c) => c.drawStyle !== DrawStyle.Points,
        })
        .addSliderInput({
          path: 'pointSize',
          name: 'Point size',
          category: categoryStyles,
          defaultValue: 5,
          settings: {
            min: 1,
            max: 40,
            step: 1,
          },
          showIf: (c) => c.showPoints !== PointVisibility.Never || c.drawStyle === DrawStyle.Points,
        });

      addStackingConfig(builder, cfg.stacking);
      addAxisConfig(builder, cfg);
      addHideFrom(builder);

      builder.addRadio({
        path: 'thresholds.mode',
        name: 'Show thresholds',
        category: categoryStyles,
        defaultValue: graphFieldOptions.thresholdsMode[0].value,
        settings: {
          options: graphFieldOptions.thresholdsMode,
        },
      });
    },
  };
}

export function addHideFrom(builder: FieldConfigEditorBuilder<HideableFieldConfig>) {
  builder.addCustomEditor({
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
}

export function addAxisConfig(
  builder: FieldConfigEditorBuilder<AxisConfig>,
  defaultConfig: AxisConfig,
  hideScale?: boolean
) {
  builder
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
      defaultValue: defaultConfig.axisSoftMin,
      category: ['Axis'],
      settings: {
        placeholder: 'See: Standard options > Min',
      },
    })
    .addNumberInput({
      path: 'axisSoftMax',
      name: 'Soft max',
      defaultValue: defaultConfig.axisSoftMax,
      category: ['Axis'],
      settings: {
        placeholder: 'See: Standard options > Max',
      },
    });
  if (!hideScale) {
    builder.addCustomEditor<void, ScaleDistributionConfig>({
      id: 'scaleDistribution',
      path: 'scaleDistribution',
      name: 'Scale',
      category: ['Axis'],
      editor: ScaleDistributionEditor,
      override: ScaleDistributionEditor,
      defaultValue: { type: ScaleDistribution.Linear },
      shouldApply: (f) => f.type === FieldType.number,
      process: identityOverrideProcessor,
    });
  }
}

export function addLegendOptions<T extends OptionsWithLegend>(builder: PanelOptionsEditorBuilder<T>) {
  builder
    .addRadio({
      path: 'legend.displayMode',
      name: 'Legend mode',
      category: ['Legend'],
      description: '',
      defaultValue: LegendDisplayMode.List,
      settings: {
        options: [
          { value: LegendDisplayMode.List, label: 'List' },
          { value: LegendDisplayMode.Table, label: 'Table' },
          { value: LegendDisplayMode.Hidden, label: 'Hidden' },
        ],
      },
    })
    .addRadio({
      path: 'legend.placement',
      name: 'Legend placement',
      category: ['Legend'],
      description: '',
      defaultValue: 'bottom',
      settings: {
        options: [
          { value: 'bottom', label: 'Bottom' },
          { value: 'right', label: 'Right' },
        ],
      },
      showIf: (c) => c.legend.displayMode !== LegendDisplayMode.Hidden,
    })
    .addCustomEditor<StatsPickerConfigSettings, string[]>({
      id: 'legend.calcs',
      path: 'legend.calcs',
      name: 'Legend values',
      category: ['Legend'],
      description: 'Select values or calculations to show in legend',
      editor: standardEditorsRegistry.get('stats-picker').editor as any,
      defaultValue: [],
      settings: {
        allowMultiple: true,
      },
      showIf: (currentConfig) => currentConfig.legend.displayMode !== LegendDisplayMode.Hidden,
    });
}

export function addStackingConfig(
  builder: FieldConfigEditorBuilder<{ stacking: StackingConfig }>,
  defaultConfig?: StackingConfig
) {
  builder.addCustomEditor({
    id: 'stacking',
    path: 'stacking',
    name: 'Stack series',
    category: categoryStyles,
    defaultValue: defaultConfig,
    editor: StackingEditor,
    override: StackingEditor,
    settings: {
      options: graphFieldOptions.stacking,
    },
    process: identityOverrideProcessor,
    shouldApply: (f) => f.type === FieldType.number,
  });
}
