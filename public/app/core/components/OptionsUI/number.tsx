import { useCallback } from 'react';

import { StandardEditorProps, NumberFieldConfigSettings } from '@grafana/data';

import { NumberInput } from './NumberInput';

type Props = StandardEditorProps<number, NumberFieldConfigSettings>;

export const NumberValueEditor = ({ value, onChange, item }: Props) => {
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
