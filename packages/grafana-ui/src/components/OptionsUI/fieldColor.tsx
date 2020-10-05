import React from 'react';
import { FieldConfigEditorProps, FieldColorMode, SelectableValue, FieldColor } from '@grafana/data';
import { Select } from '../Select/Select';
import { fieldColorModeRegistry } from '@grafana/data/src/field/fieldColor';

export const FieldColorEditor: React.FC<FieldConfigEditorProps<FieldColor | undefined, {}>> = ({
  value,
  onChange,
  item,
}) => {
  const options = fieldColorModeRegistry.list().map(mode => {
    return {
      value: mode.id,
      label: mode.name,
    };
  });

  const onModeChange = (newMode: SelectableValue<string>) => {
    onChange({
      mode: newMode.value! as FieldColorMode,
    });
  };

  const mode = value?.mode ?? FieldColorMode.Thresholds;

  return <Select options={options} value={mode} onChange={onModeChange} />;
};
