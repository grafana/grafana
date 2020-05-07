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
    (e: React.SyntheticEvent) => {
      if (e.hasOwnProperty('key')) {
        // handling keyboard event
        if ((e as React.KeyboardEvent).key === 'Enter') {
          onChange((e as React.KeyboardEvent).currentTarget.value.trim() === '' ? undefined : e.currentTarget.value);
        }
      } else {
        // handling form event
        onChange(
          (e as React.FormEvent<HTMLInputElement>).currentTarget.value.trim() === '' ? undefined : e.currentTarget.value
        );
      }
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
      onBlur={onValueChange}
      onKeyDown={onValueChange}
    />
  );
};
