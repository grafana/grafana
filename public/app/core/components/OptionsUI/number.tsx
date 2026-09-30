import { useCallback } from 'react';

import { type StandardEditorProps, type NumberFieldConfigSettings } from '@grafana/data';

import { NumberInput } from './NumberInput';

type NumberEditorProps = StandardEditorProps<number, NumberFieldConfigSettings>;
type Props = Omit<NumberEditorProps, 'item'> & { item: Partial<NumberEditorProps['item']> };

export const NumberValueEditor = ({ value, onChange, item, id }: Props) => {
  const { settings } = item;

  const onValueChange = useCallback(
    (value: number | undefined) => {
      onChange(settings?.integer && value !== undefined ? Math.floor(value) : value);
    },
    [onChange, settings?.integer]
  );

  return (
    <NumberInput
      id={id}
      value={value}
      min={settings?.min}
      max={settings?.max}
      step={settings?.step}
      placeholder={settings?.placeholder}
      onChange={onValueChange}
    />
  );
};
