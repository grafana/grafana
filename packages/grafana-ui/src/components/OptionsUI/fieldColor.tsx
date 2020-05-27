import React from 'react';
import { FieldConfigEditorProps, FieldColorMode, SelectableValue, FieldColor } from '@grafana/data';
import { Select } from '../Select/Select';

export const FieldColorEditor: React.FC<FieldConfigEditorProps<FieldColor | undefined, {}>> = ({
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
      label: 'Reds',
      value: FieldColorMode.SchemeReds,
      description: 'Dark red to light red',
    },
    {
      label: 'Green',
      value: FieldColorMode.SchemeGreens,
      description: 'Dark green to light green',
    },
    {
      label: 'Blues',
      value: FieldColorMode.SchemeBlues,
      description: 'Dark blue to light blue',
    },
    {
      label: 'Scheme GrYlRd',
      value: FieldColorMode.SchemeGrYlRd,
      description: 'Green - Yellow - Red',
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
