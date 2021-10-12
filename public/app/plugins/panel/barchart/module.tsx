import {
  DataFrame,
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  PanelPlugin,
  SelectableValue,
  StandardEditorProps,
  VizOrientation,
} from '@grafana/data';
import { BarChartPanel } from './BarChartPanel';
import { StackingMode, VisibilityMode } from '@grafana/schema';
import { graphFieldOptions, commonOptionsBuilder, HorizontalGroup, RadioButtonGroup, Input } from '@grafana/ui';

import {
  BarChartFieldConfig,
  BarChartOptions,
  defaultBarChartFieldConfig,
  ValueRotationConfig,
} from 'app/plugins/panel/barchart/types';
import React from 'react';

export const plugin = new PanelPlugin<BarChartOptions, BarChartFieldConfig>(BarChartPanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
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

      commonOptionsBuilder.addAxisConfig(builder, cfg, true);
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    builder
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
        defaultValue: VizOrientation.Auto,
      })
      .addCustomEditor<void, ValueRotationConfig>({
        id: 'valueRotation',
        path: 'valueRotation',
        name: 'Rotate values',
        editor: ValueRotationEditor,
        defaultValue: { presetRotation: 0 },
        showIf: (opts) => {
          return opts.orientation === VizOrientation.Auto || opts.orientation === VizOrientation.Vertical;
        },
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
        defaultValue: VisibilityMode.Auto,
      })
      .addRadio({
        path: 'stacking',
        name: 'Stacking',
        settings: {
          options: graphFieldOptions.stacking,
        },
        defaultValue: StackingMode.None,
      })
      .addSliderInput({
        path: 'groupWidth',
        name: 'Group width',
        defaultValue: 0.7,
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
        defaultValue: 0.97,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
    commonOptionsBuilder.addTextSizeOptions(builder, false);
  });

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

const ROTATION_OPTIONS: Array<SelectableValue<number | undefined>> = [
  { label: 'No rotation', value: 0 },
  { label: '45°', value: -45 },
  { label: '90°', value: -90 },
  { label: 'Custom', value: undefined },
];

const ValueRotationEditor: React.FC<StandardEditorProps<ValueRotationConfig>> = ({ value, onChange }) => {
  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value.presetRotation}
        options={ROTATION_OPTIONS}
        onChange={(v: number | undefined) => {
          onChange({ ...value, presetRotation: v });
        }}
      ></RadioButtonGroup>
      {value.presetRotation === undefined && (
        <Input
          value={value.customRotation || 0}
          type="number"
          onChange={(e) => {
            onChange({ ...value, customRotation: e.currentTarget.valueAsNumber });
          }}
        ></Input>
      )}
    </HorizontalGroup>
  );
};
