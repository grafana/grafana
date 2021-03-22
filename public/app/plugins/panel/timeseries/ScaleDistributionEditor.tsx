import React from 'react';
import { FieldOverrideEditorProps, SelectableValue } from '@grafana/data';
import { HorizontalGroup, RadioButtonGroup, ScaleDistribution, ScaleDistributionConfig, Select } from '@grafana/ui';

const DISTRIBUTION_OPTIONS: Array<SelectableValue<ScaleDistribution>> = [
  {
    label: 'Linear',
    value: ScaleDistribution.Linear,
  },
  {
    label: 'Logarithmic',
    value: ScaleDistribution.Logarithmic,
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

export const ScaleDistributionEditor: React.FC<FieldOverrideEditorProps<ScaleDistributionConfig, any>> = ({
  value,
  onChange,
}) => {
  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value.type || ScaleDistribution.Linear}
        options={DISTRIBUTION_OPTIONS}
        onChange={(v) => {
          console.log(v, value);
          onChange({
            ...value,
            type: v!,
            log: v === ScaleDistribution.Linear ? undefined : 2,
          });
        }}
      />
      {value.type === ScaleDistribution.Logarithmic && (
        <Select
          allowCustomValue={false}
          autoFocus
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
