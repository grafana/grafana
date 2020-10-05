import React from 'react';
import { FieldConfigEditorProps, FieldColorMode, SelectableValue, FieldColor } from '@grafana/data';
import { Select } from '../Select/Select';
import { fieldColorModeRegistry } from '@grafana/data/src/field/fieldColor';
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
    };
  });

  const onModeChange = (newMode: SelectableValue<string>) => {
    onChange({
      mode: newMode.value! as FieldColorMode,
    });
  };

  const onColorChange = (color?: string) => {
    onChange({
      mode,
      fixedColor: color,
    });
  };

  const mode = value?.mode ?? FieldColorMode.Thresholds;
  if (mode === FieldColorMode.Fixed) {
    return (
      <HorizontalGroup>
        <Select options={options} value={mode} onChange={onModeChange} />
        <ColorValueEditor value={value?.fixedColor} onChange={onColorChange} />
      </HorizontalGroup>
    );
  }

  return <Select options={options} value={mode} onChange={onModeChange} />;
};
