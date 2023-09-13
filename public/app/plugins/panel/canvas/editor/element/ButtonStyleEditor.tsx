import React, { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { ButtonVariant, InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import { defaultStyleConfig } from 'app/features/canvas/elements/button';

export interface ButtonStyleConfig {
  variant: ButtonVariant;
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
    (variant: ButtonVariant) => {
      onChange({
        ...value,
        variant,
      });
    },
    [onChange, value]
  );

  return (
    <>
      <InlineFieldRow>
        <InlineField label="Method" grow={true}>
          <RadioButtonGroup value={value?.variant} options={variantOptions} onChange={onVariantChange} fullWidth />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
