import React, { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { InlineField, InlineFieldRow, Select } from '@grafana/ui';
import { defaultStyleConfig } from 'app/features/canvas/elements/button';

export interface ButtonStyleConfig {
  variant: string;
}

type Props = StandardEditorProps<ButtonStyleConfig>;

const variantOptions: SelectableValue[] = [
  { label: 'primary', value: 'primary' },
  { label: 'secondary', value: 'secondary' },
  { label: 'success', value: 'success' },
  { label: 'destructive', value: 'destructive' },
];

export const ButtonStyleEditor = ({ value, onChange }: Props) => {
  if (!value) {
    value = defaultStyleConfig;
  }

  const onVariantChange = useCallback(
    (variant: SelectableValue<string>) => {
      onChange({
        ...value,
        variant: variant?.value ?? defaultStyleConfig.variant,
      });
    },
    [onChange, value]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Variant" grow={true}>
          <Select options={variantOptions} value={value?.variant} onChange={onVariantChange} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
