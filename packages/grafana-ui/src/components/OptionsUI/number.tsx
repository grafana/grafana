import React, { useCallback, useState } from 'react';
import { FieldConfigEditorProps, NumberFieldConfigSettings } from '@grafana/data';
import { Input } from '../Input/Input';

export const NumberValueEditor: React.FC<FieldConfigEditorProps<number, NumberFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;
  const [inputValue, setInputValue] = useState(isNaN(value) ? '' : value.toString());

  const onValueChange = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      const num = e.currentTarget.value;
      let value: number | undefined = undefined;

      if (num && !Number.isNaN(e.currentTarget.valueAsNumber)) {
        value = e.currentTarget.valueAsNumber;
      }

      if (e.hasOwnProperty('key')) {
        // handling keyboard event
        const evt = e as React.KeyboardEvent<HTMLInputElement>;
        if (evt.key === 'Enter') {
          onChange(value);
        }
      } else {
        // handling form event
        onChange(value);
      }
    },
    [onChange]
  );

  const onLocalChange = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      const num = e.currentTarget.valueAsNumber;
      let newValue: number | undefined = undefined;

      if (!Number.isNaN(num)) {
        if (settings?.min !== undefined && settings.min > num) {
          newValue = settings.min;
        } else if (settings?.max !== undefined && settings?.max < num) {
          newValue = settings.max;
        } else {
          newValue = Number(e.currentTarget.value);
        }

        if (settings?.integer) {
          newValue = Math.floor(newValue);
        }
      }
      setInputValue(newValue ? newValue.toString() : '');
    },
    [settings?.max, settings?.min, settings?.integer, setInputValue]
  );

  return (
    <Input
      value={inputValue}
      min={settings?.min}
      max={settings?.max}
      type="number"
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={onLocalChange}
      onBlur={onValueChange}
      onKeyDown={onValueChange}
    />
  );
};
