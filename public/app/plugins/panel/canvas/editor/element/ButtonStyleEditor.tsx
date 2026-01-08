import { useCallback } from 'react';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ButtonVariant, InlineField, InlineFieldRow, Select } from '@grafana/ui';
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
    (variant: SelectableValue<ButtonVariant>) => {
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
        <InlineField label={t('canvas.button-style-editor.label-variant', 'Variant')} grow={true}>
          <Select options={variantOptions} value={value?.variant} onChange={onVariantChange} />
        </InlineField>
      </InlineFieldRow>
    </>
  );
};
