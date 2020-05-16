import React from 'react';
import { FieldConfigEditorProps, FieldColorMode, SelectableValue, FieldColor } from '@grafana/data';
import { Select } from '../Select/Select';

export const ColorValueEditor: React.FC<FieldConfigEditorProps<FieldColor | undefined, {}>> = ({
  value,
  onChange,
  item,
}) => {
  const options = [
    {
      label: 'From thresholds',
      value: FieldColorMode.Thresholds,
      description: 'Get color from thresholds',
    },
    {
      label: 'From thresholds and interpolate',
      value: FieldColorMode.ThresholdsInterpolate,
      description: 'Get color from thresholds and interpolate color',
    },
  ];

  const onModeChange = (newMode: SelectableValue<FieldColorMode>) => {
    onChange({
      mode: newMode.value!,
    });
  };

  const mode = (value ?? { mode: FieldColorMode.Thresholds }).mode;

  return <Select options={options} value={mode} onChange={onModeChange} />;
};
