import React from 'react';

import {
  FieldConfigEditorBuilder,
  FieldType,
  identityOverrideProcessor,
  SelectableValue,
  StandardEditorProps,
} from '@grafana/data';
import { AxisColorMode, AxisConfig, AxisPlacement, ScaleDistribution, ScaleDistributionConfig } from '@grafana/schema';

import { graphFieldOptions, Select, HorizontalGroup, RadioButtonGroup } from '../../index';

/**
 * @alpha
 */
export function addAxisConfig(
  builder: FieldConfigEditorBuilder<AxisConfig>,
  defaultConfig: AxisConfig,
  hideScale?: boolean
) {
  const category = ['Axis'];
  builder
    .addRadio({
      path: 'axisPlacement',
      name: 'Placement',
      category,
      defaultValue: graphFieldOptions.axisPlacement[0].value,
      settings: {
        options: graphFieldOptions.axisPlacement,
      },
    })
    .addTextInput({
      path: 'axisLabel',
      name: 'Label',
      category,
      defaultValue: '',
      settings: {
        placeholder: 'Optional text',
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
      // Do not apply default settings to time and string fields which are used as x-axis fields in Time series and Bar chart panels
      shouldApply: (f) => f.type !== FieldType.time && f.type !== FieldType.string,
    })
    .addNumberInput({
      path: 'axisWidth',
      name: 'Width',
      category,
      settings: {
        placeholder: 'Auto',
      },
      showIf: (c) => c.axisPlacement !== AxisPlacement.Hidden,
    })
    .addNumberInput({
      path: 'axisSoftMin',
      name: 'Soft min',
      defaultValue: defaultConfig.axisSoftMin,
      category,
      settings: {
        placeholder: 'See: Standard options > Min',
      },
    })
    .addNumberInput({
      path: 'axisSoftMax',
      name: 'Soft max',
      defaultValue: defaultConfig.axisSoftMax,
      category,
      settings: {
        placeholder: 'See: Standard options > Max',
      },
    })
    .addRadio({
      path: 'axisGridShow',
      name: 'Show grid lines',
      category,
      defaultValue: undefined,
      settings: {
        options: [
          { value: undefined, label: 'Auto' },
          { value: true, label: 'On' },
          { value: false, label: 'Off' },
        ],
      },
    })
    .addRadio({
      path: 'axisColorMode',
      name: 'Color',
      category,
      defaultValue: AxisColorMode.Text,
      settings: {
        options: [
          { value: AxisColorMode.Text, label: 'Text' },
          { value: AxisColorMode.Series, label: 'Series' },
        ],
      },
    });

  if (!hideScale) {
    builder.addCustomEditor<void, ScaleDistributionConfig>({
      id: 'scaleDistribution',
      path: 'scaleDistribution',
      name: 'Scale',
      category,
      editor: ScaleDistributionEditor as any,
      override: ScaleDistributionEditor as any,
      defaultValue: { type: ScaleDistribution.Linear },
      shouldApply: (f) => f.type === FieldType.number,
      process: identityOverrideProcessor,
    });
  }
}

const DISTRIBUTION_OPTIONS: Array<SelectableValue<ScaleDistribution>> = [
  {
    label: 'Linear',
    value: ScaleDistribution.Linear,
  },
  {
    label: 'Logarithmic',
    value: ScaleDistribution.Log,
  },
];

const LOG_DISTRIBUTION_OPTIONS: Array<SelectableValue<number>> = [
  {
    label: '2',
    value: 2,
  },
  {
    label: '10',
    value: 10,
  },
];

/**
 * @internal
 */
export const ScaleDistributionEditor = ({ value, onChange }: StandardEditorProps<ScaleDistributionConfig>) => {
  const type = value?.type ?? ScaleDistribution.Linear;
  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={type}
        options={DISTRIBUTION_OPTIONS}
        onChange={(v) => {
          onChange({
            ...value,
            type: v!,
            log: v === ScaleDistribution.Linear ? undefined : 2,
          });
        }}
      />
      {type === ScaleDistribution.Log && (
        <Select
          options={LOG_DISTRIBUTION_OPTIONS}
          value={value.log || 2}
          prefix={'base'}
          width={12}
          onChange={(v) => {
            onChange({
              ...value,
              log: v.value!,
            });
          }}
        />
      )}
    </HorizontalGroup>
  );
};
