import React, { useCallback } from 'react';

import { FieldConfigEditorProps, NumberFieldConfigSettings } from '@grafana/data';

import { NumberInput } from './NumberInput';

type Props = FieldConfigEditorProps<number, NumberFieldConfigSettings>;

export const NumberValueEditor = ({ value, onChange, item, min, max }: Props) => {
  const { settings } = item;

  const onValueChange = useCallback(
    (value: number | undefined) => {
      onChange(settings?.integer && value !== undefined ? Math.floor(value) : value);
    },
    [onChange, settings?.integer]
  );

  return (
    <NumberInput
      value={value}
      min={min ?? settings?.min}
      max={max ?? settings?.max}
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={onValueChange}
    />
  );
};
