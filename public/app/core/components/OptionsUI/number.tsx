import React, { useCallback } from 'react';

import { FieldConfigEditorProps, NumberFieldConfigSettings } from '@grafana/data';

import { NumberInput } from './NumberInput';

export const NumberValueEditor: React.FC<FieldConfigEditorProps<number, NumberFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
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
      min={settings?.min}
      max={settings?.max}
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={onValueChange}
    />
  );
};
