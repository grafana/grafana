import React from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { HorizontalGroup, Input, RadioButtonGroup, ScaleDistribution } from '@grafana/ui';

import { HeatmapCalculationBucketConfig, HeatmapCalculationMode } from '../models.gen';

const modeOptions: Array<SelectableValue<HeatmapCalculationMode>> = [
  {
    label: 'Size',
    value: HeatmapCalculationMode.Size,
    description: 'Split the buckets based on size',
  },
  {
    label: 'Count',
    value: HeatmapCalculationMode.Count,
    description: 'Split the buckets based on count',
  },
];

const logModeOptions: Array<SelectableValue<HeatmapCalculationMode>> = [
  {
    label: 'Split',
    value: HeatmapCalculationMode.Size,
    description: 'Split the buckets based on size',
  },
];

export const AxisEditor: React.FC<StandardEditorProps<HeatmapCalculationBucketConfig, any>> = ({
  value,
  onChange,
  item,
}) => {
  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value?.mode || HeatmapCalculationMode.Size}
        options={value?.scale?.type === ScaleDistribution.Log ? logModeOptions : modeOptions}
        onChange={(mode) => {
          onChange({
            ...value,
            mode,
          });
        }}
      />
      <Input
        value={value?.value ?? ''}
        placeholder="Auto"
        onChange={(v) => {
          onChange({
            ...value,
            value: v.currentTarget.value,
          });
        }}
      />
    </HorizontalGroup>
  );
};
