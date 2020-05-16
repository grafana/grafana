import React from 'react';
import { FieldConfigEditorProps, FieldColorMode, SelectableValue, FieldColor } from '@grafana/data';
import { Select } from '../Select/Select';

export const ColorValueEditor: React.FC<FieldConfigEditorProps<FieldColor, {}>> = ({ value, onChange, item }) => {
  const options = [
    {
      label: 'From thresholds',
      value: FieldColorMode.Thresholds,
      description: 'Get color from thresholds',
    },
    {
      label: 'From thresholds & interpolate',
      value: FieldColorMode.ThresholdsInterpolated,
      description: 'Get color from thresholds and interpolate color',
    },
  ];

  const onModeChange = (newMode: SelectableValue<FieldColorMode>) => {
    onChange({
      mode: newMode.value!,
    });
  };

  return <Select options={options} value={value.mode} onChange={onModeChange} />;
};
