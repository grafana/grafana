import React, { useCallback } from 'react';
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
  const onValueChange = useCallback(
    (value: string) => {
      onChange(settings?.integer ? toIntegerOrUndefined(value) : toFloatOrUndefined(value));
    },
    [onChange]
  );
  return (
    <Input
      defaultValue={isNaN(value) ? '' : value.toString()}
      min={settings?.min}
      max={settings?.max}
      type="number"
      step={settings?.step}
      placeholder={settings?.placeholder}
      onBlur={e => {
        onValueChange(e.currentTarget.value);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          onValueChange(e.currentTarget.value);
        }
      }}
    />
  );
};
