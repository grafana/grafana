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
        const evt = e as React.KeyboardEvent<HTMLInputElement>;
        if (evt.key === 'Enter') {
          onChange(
            settings?.integer
              ? toIntegerOrUndefined(evt.currentTarget.value)
              : toFloatOrUndefined(evt.currentTarget.value)
          );
        }
      } else {
        // handling form event
        const evt = e as React.FormEvent<HTMLInputElement>;
        onChange(
          settings?.integer
            ? toIntegerOrUndefined(evt.currentTarget.value)
            : toFloatOrUndefined(evt.currentTarget.value)
        );
      }
    },
    [onChange]
  );

  const defaultValue = value === undefined || value === null || isNaN(value) ? '' : value.toString();
  return (
    <Input
      defaultValue={defaultValue}
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
