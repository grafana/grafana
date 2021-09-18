import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  SetFieldConfigOptionsArgs,
} from '@grafana/data';
import { LineStyle, VisibilityMode } from '@grafana/schema';

import { commonOptionsBuilder, graphFieldOptions } from '@grafana/ui';
import { ColorDimensionEditor, ScaleDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';
import { LineStyleEditor } from '../timeseries/LineStyleEditor';
import { ScatterFieldConfig, ScatterLineMode } from './models.gen';

const categoryStyles = ['Scatter styles'];

export function getScatterFieldConfig(cfg: ScatterFieldConfig): SetFieldConfigOptionsArgs<ScatterFieldConfig> {
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
    },

    useCustomConfig: (builder) => {
      builder
        .addRadio({
          path: 'line',
          name: 'Lines',
          category: categoryStyles,
          defaultValue: cfg.line,
          settings: {
            options: [
              { label: 'None', value: ScatterLineMode.None },
              { label: 'Linear', value: ScatterLineMode.Linear },
            ],
          },
        })
        .addCustomEditor<void, LineStyle>({
          id: 'lineStyle',
          path: 'lineStyle',
          name: 'Line style',
          category: categoryStyles,
          showIf: (c) => c.line !== ScatterLineMode.None,
          editor: LineStyleEditor,
          override: LineStyleEditor,
          process: identityOverrideProcessor,
          shouldApply: (f) => f.type === FieldType.number,
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
          showIf: (c) => c.line !== ScatterLineMode.None,
        })
        .addCustomEditor({
          id: 'lineColor',
          path: 'lineColor',
          name: 'Line color',
          category: categoryStyles,
          editor: ColorDimensionEditor as any,
          override: ColorDimensionEditor as any,
          settings: {},
          defaultValue: {
            // Configured values
            fixed: 'grey',
          },
          showIf: (c) => c.line !== ScatterLineMode.None,
          process: identityOverrideProcessor,
          shouldApply: (f) => true,
        })
        .addRadio({
          path: 'point',
          name: 'Points',
          category: categoryStyles,
          defaultValue: cfg.point,
          settings: {
            options: graphFieldOptions.showPoints,
          },
        })
        .addCustomEditor({
          id: 'pointSize',
          path: 'pointSize',
          name: 'Point size',
          category: categoryStyles,
          editor: ScaleDimensionEditor as any,
          override: ScaleDimensionEditor as any,
          settings: {},
          defaultValue: {
            // Configured values
            fixed: 'grey',
          },
          showIf: (c) => c.point !== VisibilityMode.Never,
          process: identityOverrideProcessor,
          shouldApply: (f) => true,
        })
        .addCustomEditor({
          id: 'pointColor',
          path: 'pointColor',
          name: 'Point color',
          category: categoryStyles,
          editor: ColorDimensionEditor as any,
          override: ColorDimensionEditor as any,
          settings: {},
          defaultValue: {
            // Configured values
            fixed: 'grey',
          },
          showIf: (c) => c.point !== VisibilityMode.Never,
          process: identityOverrideProcessor,
          shouldApply: (f) => true,
        })
        .addRadio({
          path: 'label',
          name: 'Labels',
          category: categoryStyles,
          defaultValue: cfg.label,
          settings: {
            options: graphFieldOptions.showPoints,
          },
        })
        .addCustomEditor({
          id: 'labelText',
          path: 'labelText',
          name: 'Label text',
          category: categoryStyles,
          editor: TextDimensionEditor as any,
          override: TextDimensionEditor as any,
          settings: {},
          defaultValue: {
            placeholderText: 'Value',
          },
          showIf: (c) => c.label !== VisibilityMode.Never,
          process: identityOverrideProcessor,
          shouldApply: (f) => true,
        });

      commonOptionsBuilder.addAxisConfig(builder, cfg);
      commonOptionsBuilder.addHideFrom(builder);
    },
  };
}
