import React from 'react';
import {
  FieldConfigEditorProps,
  toIntegerOrUndefined,
  toFloatOrUndefined,
  NumberFieldConfigSettings,
} from '@grafana/data';
import { Input } from '../Input/Input';

export const NumberValueEditor: React.FC<FieldConfigEditorProps<number, NumberFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  return (
    <Input
      value={isNaN(value) ? '' : value}
      min={settings?.min}
      max={settings?.max}
      type="number"
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={e => {
        onChange(
          settings?.integer ? toIntegerOrUndefined(e.currentTarget.value) : toFloatOrUndefined(e.currentTarget.value)
        );
      }}
    />
  );
};
