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
    (e: React.SyntheticEvent) => {
      let v: number | undefined = +inputValue;
      if (isNaN(v)) {
        v = undefined;
      }
      if (e.hasOwnProperty('key')) {
        // handling keyboard event
        const evt = e as React.KeyboardEvent<HTMLInputElement>;
        if (evt.key === 'Enter') {
          onChange(v);
        }
      } else {
        // handling form event
        onChange(v);
      }
    },
    [onChange, inputValue]
  );

  const onLocalChange = useCallback(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      let num = e.currentTarget.valueAsNumber;

      if (isNaN(num)) {
        const v = e.currentTarget.value;
        if (v === '' || v === '-') {
          setInputValue(v);
        }
      } else {
        if (settings?.min !== undefined && settings.min > num) {
          num = settings.min;
        }

        if (settings?.max !== undefined && settings.max > num) {
          num = settings.max;
        }
        if (settings?.integer) {
          num = Math.floor(num);
        }
        setInputValue(num.toString());
      }
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
