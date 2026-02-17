import { ReactElement } from 'react';

import { t } from '@grafana/i18n';
import { Button, Combobox, ComboboxOption, Field, Stack } from '@grafana/ui';

export interface DefaultValueEditorProps {
  values: string[];
  options?: Array<ComboboxOption<string>>;
  onChange: (values: string[]) => void;
  'data-testid'?: string;
}

interface DefaultValueRowProps {
  value: string;
  options: Array<ComboboxOption<string>>;
  onChange: (value: string) => void;
  onRemove: () => void;
}

function DefaultValueRow({ value, options, onChange, onRemove }: DefaultValueRowProps): ReactElement {
  return (
    <Stack gap={0.5} alignItems="center">
      <Combobox
        aria-label={t('dashboard-scene.default-value-row.value-aria-label', 'Default value')}
        placeholder={t('dashboard-scene.default-value-row.value-placeholder', 'Value')}
        value={value || null}
        options={options}
        onChange={(option) => onChange(option.value)}
        createCustomValue
      />
      <Button
        aria-label={t('dashboard-scene.default-value-row.remove-aria-label', 'Remove default value')}
        icon="times"
        variant="secondary"
        fill="text"
        onClick={onRemove}
        tooltip={t('dashboard-scene.default-value-row.remove-tooltip', 'Remove value')}
      />
    </Stack>
  );
}

export function DefaultValueEditor({ values, options = [], onChange, ...rest }: DefaultValueEditorProps): ReactElement {
  const onAddValue = () => {
    onChange([...values, '']);
  };

  const onRemoveValue = (index: number) => {
    const newValues = [...values];
    newValues.splice(index, 1);
    onChange(newValues);
  };

  const onChangeValue = (index: number, value: string) => {
    const newValues = [...values];
    newValues[index] = value;
    onChange(newValues);
  };

  return (
    <Stack direction="column" gap={1} data-testid={rest['data-testid']}>
      <Field
        label={t('dashboard-scene.default-value-editor.label', 'Default value')}
        description={t('dashboard-scene.default-value-editor.description', 'Values that are pre-selected by default.')}
        noMargin
      >
        <Stack direction="column" gap={0.5}>
          {values.map((value, index) => (
            <DefaultValueRow
              key={index}
              value={value}
              options={options}
              onChange={(updatedValue) => onChangeValue(index, updatedValue)}
              onRemove={() => onRemoveValue(index)}
            />
          ))}
        </Stack>
      </Field>
      <div>
        <Button
          icon="plus"
          variant="secondary"
          size="sm"
          onClick={onAddValue}
          aria-label={t('dashboard-scene.default-value-editor.add-aria-label', 'Add default value')}
          type="button"
        >
          {t('dashboard-scene.default-value-editor.add-button', 'Add value')}
        </Button>
      </div>
    </Stack>
  );
}
