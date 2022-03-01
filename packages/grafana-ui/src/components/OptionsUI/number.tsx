import React, { useCallback, useRef } from 'react';
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
  const valueRef = useRef<string | undefined>();
  const onSafeChange = useCallback(
    (value: string) => {
      let num = settings?.integer ? toIntegerOrUndefined(value) : toFloatOrUndefined(value);
      if (num !== undefined) {
        if (settings?.min !== undefined && settings.min > num) {
          num = settings.min;
        }

        if (settings?.max !== undefined && settings.max > num) {
          num = settings.max;
        }
      }

      onChange(num);
    },
    [settings?.integer, settings?.min, settings?.max, onChange]
  );

  const onValueChange = useCallback(
    (e: React.SyntheticEvent) => {
      if (e.hasOwnProperty('key')) {
        // handling keyboard event
        const evt = e as React.KeyboardEvent<HTMLInputElement>;
        valueRef.current = evt.currentTarget.value;
        if (evt.key === 'Enter') {
          onSafeChange(evt.currentTarget.value);
        }
      } else {
        // handling form event
        const evt = e as React.FormEvent<HTMLInputElement>;
        valueRef.current = evt.currentTarget.value;
        onSafeChange(evt.currentTarget.value);
      }
    },
    [onSafeChange]
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
      key={valueRef.current}
    />
  );
};
