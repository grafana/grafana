import React from 'react';
import { FieldConfigEditorProps, NumberFieldConfigSettings } from '@grafana/data';
import { NumberInput } from '../NumberInput/NumberInput';

export const NumberValueEditor: React.FC<FieldConfigEditorProps<number, NumberFieldConfigSettings>> = ({
  value,
  onChange,
  item,
}) => {
  const { settings } = item;

  return (
    <NumberInput
      value={value}
      min={settings?.min}
      max={settings?.max}
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={onChange}
    />
  );
};
