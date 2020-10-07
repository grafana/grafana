import React from 'react';
import {
  FieldConfigEditorProps,
  FieldColorModeId,
  SelectableValue,
  FieldColor,
  fieldColorModeRegistry,
} from '@grafana/data';
import { Select } from '../Select/Select';
import { ColorValueEditor } from './color';
import { HorizontalGroup } from '../Layout/Layout';

export const FieldColorEditor: React.FC<FieldConfigEditorProps<FieldColor | undefined, {}>> = ({
  value,
  onChange,
  item,
}) => {
  const options = fieldColorModeRegistry.list().map(mode => {
    return {
      value: mode.id,
      label: mode.name,
      description: mode.description,
    };
  });

  const onModeChange = (newMode: SelectableValue<string>) => {
    onChange({
      mode: newMode.value! as FieldColorModeId,
    });
  };

  const onColorChange = (color?: string) => {
    onChange({
      mode,
      fixedColor: color,
    });
  };

  const mode = value?.mode ?? FieldColorModeId.Thresholds;

  if (mode === FieldColorModeId.Fixed) {
    return (
      <HorizontalGroup>
        <Select options={options} value={mode} onChange={onModeChange} />
        <ColorValueEditor value={value?.fixedColor} onChange={onColorChange} />
      </HorizontalGroup>
    );
  }

  return <Select options={options} value={mode} onChange={onModeChange} />;
};
