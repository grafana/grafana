import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  SetFieldConfigOptionsArgs,
  Field,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  BarAlignment,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  LineStyle,
  VisibilityMode,
  StackingMode,
  GraphThresholdsStyleMode,
  GraphTransform,
} from '@grafana/schema';
import { getGraphFieldOptions, commonOptionsBuilder } from '@grafana/ui';

import { InsertNullsEditor } from './InsertNullsEditor';
import { LineStyleEditor } from './LineStyleEditor';
import { SpanNullsEditor } from './SpanNullsEditor';
import { ThresholdsStyleEditor } from './ThresholdsStyleEditor';

export const defaultGraphConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  lineInterpolation: LineInterpolation.Linear,
  lineWidth: 1,
  fillOpacity: 0,
  gradientMode: GraphGradientMode.None,
  barAlignment: BarAlignment.Center,
  barWidthFactor: 0.6,
  stacking: {
    mode: StackingMode.None,
    group: 'A',
  },
  axisGridShow: true,
  axisCenteredZero: false,
  axisBorderShow: false,
  showValues: false,
};

export type NullEditorSettings = { isTime: boolean };

export function getGraphFieldConfig(cfg: GraphFieldConfig, isTime = true): SetFieldConfigOptionsArgs<GraphFieldConfig> {
  const graphFieldOptions = getGraphFieldOptions();
  const categoryStyles = [t('timeseries.config.get-graph-field-config.category-graph-styles', 'Graph styles')];
  return {
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
          bySeriesSupport: true,
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
      builder
        .addRadio({
          path: 'drawStyle',
          name: t('timeseries.config.get-graph-field-config.name-style', 'Style'),
          category: categoryStyles,
          defaultValue: cfg.drawStyle,
          settings: {
            options: graphFieldOptions.drawStyle,
          },
        })
        .addRadio({
          path: 'lineInterpolation',
          name: t('timeseries.config.get-graph-field-config.name-line-interpolation', 'Line interpolation'),
          category: categoryStyles,
          defaultValue: cfg.lineInterpolation,
          settings: {
            options: graphFieldOptions.lineInterpolation,
          },
          showIf: (config) => config.drawStyle === GraphDrawStyle.Line,
        })
        .addRadio({
          path: 'barAlignment',
          name: t('timeseries.config.get-graph-field-config.name-bar-alignment', 'Bar alignment'),
          category: categoryStyles,
          defaultValue: cfg.barAlignment,
          settings: {
            options: graphFieldOptions.barAlignment,
          },
          showIf: (config) => config.drawStyle === GraphDrawStyle.Bars,
        })
        .addSliderInput({
          path: 'barWidthFactor',
          name: t('timeseries.config.get-graph-field-config.name-bar-width-factor', 'Bar width factor'),
          category: categoryStyles,
          defaultValue: cfg.barWidthFactor,
          settings: {
            min: 0.1,
            max: 1.0,
            step: 0.1,
            ariaLabelForHandle: t(
              'timeseries.config.get-graph-field-config.aria-label-bar-width-factor',
              'Bar width factor'
            ),
          },
          showIf: (config) => config.drawStyle === GraphDrawStyle.Bars,
        })
        .addSliderInput({
          path: 'lineWidth',
          name: t('timeseries.config.get-graph-field-config.name-line-width', 'Line width'),
          category: categoryStyles,
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
            ariaLabelForHandle: t('timeseries.config.get-graph-field-config.aria-label-line-width', 'Line width'),
          },
          showIf: (config) => config.drawStyle !== GraphDrawStyle.Points,
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: t('timeseries.config.get-graph-field-config.name-fill-opacity', 'Fill opacity'),
          category: categoryStyles,
          defaultValue: cfg.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
            ariaLabelForHandle: t('timeseries.config.get-graph-field-config.aria-label-fill-opacity', 'Fill opacity'),
          },
          showIf: (config) => config.drawStyle !== GraphDrawStyle.Points,
        })
        .addRadio({
          path: 'gradientMode',
          name: t('timeseries.config.get-graph-field-config.name-gradient-mode', 'Gradient mode'),
          category: categoryStyles,
          defaultValue: graphFieldOptions.fillGradient[0].value,
          settings: {
            options: graphFieldOptions.fillGradient,
          },
          showIf: (config) => config.drawStyle !== GraphDrawStyle.Points,
        })
        .addFieldNamePicker({
          path: 'fillBelowTo',
          name: t('timeseries.config.get-graph-field-config.name-fill-below-to', 'Fill below to'),
          category: categoryStyles,
          hideFromDefaults: true,
          settings: {
            filter: (field: Field) => field.type === FieldType.number,
          },
        })
        .addCustomEditor<void, LineStyle>({
          id: 'lineStyle',
          path: 'lineStyle',
          name: t('timeseries.config.get-graph-field-config.name-line-style', 'Line style'),
          category: categoryStyles,
          showIf: (config) => config.drawStyle === GraphDrawStyle.Line,
          editor: LineStyleEditor,
          override: LineStyleEditor,
          process: identityOverrideProcessor,
          shouldApply: (field) => field.type === FieldType.number,
        })
        .addCustomEditor<NullEditorSettings, boolean>({
          id: 'spanNulls',
          path: 'spanNulls',
          name: t('timeseries.config.get-graph-field-config.name-connect-nulls', 'Connect null values'),
          category: categoryStyles,
          defaultValue: false,
          editor: SpanNullsEditor,
          override: SpanNullsEditor,
          showIf: (config) => config.drawStyle === GraphDrawStyle.Line,
          shouldApply: (field) => field.type !== FieldType.time,
          process: identityOverrideProcessor,
          settings: { isTime },
        })
        .addCustomEditor<NullEditorSettings, boolean>({
          id: 'insertNulls',
          path: 'insertNulls',
          name: t('timeseries.config.get-graph-field-config.name-disconnect-values', 'Disconnect values'),
          category: categoryStyles,
          defaultValue: false,
          editor: InsertNullsEditor,
          override: InsertNullsEditor,
          showIf: (config) => config.drawStyle === GraphDrawStyle.Line,
          shouldApply: (field) => field.type !== FieldType.time,
          process: identityOverrideProcessor,
          settings: { isTime },
        })
        .addRadio({
          path: 'showPoints',
          name: t('timeseries.config.get-graph-field-config.name-show-points', 'Show points'),
          category: categoryStyles,
          defaultValue: graphFieldOptions.showPoints[0].value,
          settings: {
            options: graphFieldOptions.showPoints,
          },
          showIf: (config) => config.drawStyle !== GraphDrawStyle.Points,
        })
        .addRadio({
          path: 'showValues',
          name: t('timeseries.config.get-graph-field-config.name-show-values', 'Show values'),
          category: categoryStyles,
          defaultValue: graphFieldOptions.showValues[0].value,
          settings: {
            options: graphFieldOptions.showValues,
          },
        })
        .addSliderInput({
          path: 'pointSize',
          name: t('timeseries.config.get-graph-field-config.name-point-size', 'Point size'),
          category: categoryStyles,
          defaultValue: 5,
          settings: {
            min: 1,
            max: 40,
            step: 1,
            ariaLabelForHandle: t('timeseries.config.get-graph-field-config.aria-label-point-size', 'Point size'),
          },
          showIf: (config) => config.showPoints !== VisibilityMode.Never || config.drawStyle === GraphDrawStyle.Points,
        });

      commonOptionsBuilder.addStackingConfig(builder, cfg.stacking, categoryStyles);

      builder.addSelect({
        category: categoryStyles,
        name: t('timeseries.config.get-graph-field-config.name-transform', 'Transform'),
        path: 'transform',
        settings: {
          options: [
            {
              label: t('timeseries.config.get-graph-field-config.transform-options.label-constant', 'Constant'),
              value: GraphTransform.Constant,
              description: t(
                'timeseries.config.get-graph-field-config.transform-options.description-constant',
                'The first value will be shown as a constant line'
              ),
            },
            {
              label: t('timeseries.config.get-graph-field-config.transform-options.label-style', 'Negative Y'),
              value: GraphTransform.NegativeY,
              description: t(
                'timeseries.config.get-graph-field-config.transform-options.description-style',
                'Flip the results to negative values on the y axis'
              ),
            },
          ],
          isClearable: true,
        },
        hideFromDefaults: true,
      });

      commonOptionsBuilder.addAxisConfig(builder, cfg);
      commonOptionsBuilder.addHideFrom(builder);

      builder.addCustomEditor({
        id: 'thresholdsStyle',
        path: 'thresholdsStyle',
        name: t('timeseries.config.get-graph-field-config.name-show-thresholds', 'Show thresholds'),
        category: [t('timeseries.config.get-graph-field-config.category-thresholds', 'Thresholds')],
        defaultValue: { mode: GraphThresholdsStyleMode.Off },
        settings: {
          options: graphFieldOptions.thresholdsDisplayModes,
        },
        editor: ThresholdsStyleEditor,
        override: ThresholdsStyleEditor,
        process: identityOverrideProcessor,
        shouldApply: () => true,
      });
    },
  };
}
