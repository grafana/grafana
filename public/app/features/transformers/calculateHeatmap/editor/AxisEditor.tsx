import React from 'react';
import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { HorizontalGroup, Input, RadioButtonGroup } from '@grafana/ui';
import { HeatmapCalculationAxisConfig, HeatmapCalculationMode } from '../models.gen';

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

export const AxisEditor: React.FC<StandardEditorProps<HeatmapCalculationAxisConfig, any>> = ({
  value,
  onChange,
  item,
}) => {
  return (
    <HorizontalGroup>
      <RadioButtonGroup
        value={value?.mode || HeatmapCalculationMode.Size}
        options={modeOptions}
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
