import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  SetFieldConfigOptionsArgs,
} from '@grafana/data';
import { LineStyle, VisibilityMode } from '@grafana/schema';
import { commonOptionsBuilder, graphFieldOptions } from '@grafana/ui';

import { LineStyleEditor } from '../timeseries/LineStyleEditor';

import { ScatterFieldConfig, ScatterLineMode } from './models.gen';

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
          path: 'point',
          name: 'Points',
          category: undefined,
          defaultValue: cfg.point,
          settings: {
            options: graphFieldOptions.showPoints,
          },
        })
        .addSliderInput({
          path: 'pointSize.fixed',
          name: 'Size',
          category: undefined,
          defaultValue: cfg.pointSize?.fixed,
          settings: {
            min: 1,
            max: 100,
            step: 1,
          },
          showIf: (c) => c.point !== VisibilityMode.Never,
        })
        .addRadio({
          path: 'line',
          name: 'Lines',
          category: undefined,
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
          category: undefined,
          showIf: (c) => c.line !== ScatterLineMode.None,
          editor: LineStyleEditor,
          override: LineStyleEditor,
          process: identityOverrideProcessor,
          shouldApply: (f) => f.type === FieldType.number,
        })
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          category: undefined,
          defaultValue: cfg.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
          showIf: (c) => c.line !== ScatterLineMode.None,
        });

      commonOptionsBuilder.addAxisConfig(builder, cfg);
      commonOptionsBuilder.addHideFrom(builder);
    },
  };
}
