import { uniqueId } from 'lodash';
import { ReactElement, useRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Combobox, ComboboxOption, Field, Stack } from '@grafana/ui';

export interface DefaultValueEditorProps {
  values: Array<ComboboxOption<string>>;
  options?: Array<ComboboxOption<string>>;
  onChange: (values: Array<ComboboxOption<string>>) => void;
}

interface DefaultValueRowProps {
  value: ComboboxOption<string>;
  options: Array<ComboboxOption<string>>;
  onChange: (option: ComboboxOption<string>) => void;
  onRemove: () => void;
}

function DefaultValueRow({ value, options, onChange, onRemove }: DefaultValueRowProps): ReactElement {
  return (
    <Stack gap={0.5} alignItems="center">
      <Combobox
        aria-label={t('dashboard-scene.default-value-row.value-aria-label', 'Default value')}
        placeholder={t('dashboard-scene.default-value-row.value-placeholder', 'Value')}
        value={value.value || null}
        options={options}
        onChange={(option) => onChange({ value: option.value, label: option.label ?? option.value })}
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

export function DefaultValueEditor({ values, options = [], onChange }: DefaultValueEditorProps): ReactElement {
  const rowIds = useRef<string[]>([]);

  while (rowIds.current.length < values.length) {
    rowIds.current.push(uniqueId('default-value-'));
  }

  const onAddValue = () => {
    onChange([...values, { value: '' }]);
  };

  const onRemoveValue = (index: number) => {
    const newValues = [...values];
    newValues.splice(index, 1);
    rowIds.current.splice(index, 1);
    onChange(newValues);
  };

  const onChangeValue = (index: number, option: ComboboxOption<string>) => {
    const newValues = [...values];
    newValues[index] = option;
    onChange(newValues);
  };

  return (
    <Stack
      direction="column"
      gap={1}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.infoText}
    >
      <Field
        label={t('dashboard-scene.default-value-editor.label', 'Default value')}
        description={t('dashboard-scene.default-value-editor.description', 'Values that are pre-selected by default.')}
        noMargin
      >
        <Stack direction="column" gap={0.5}>
          {values.map((value, index) => (
            <DefaultValueRow
              key={rowIds.current[index]}
              value={value}
              options={options}
              onChange={(updatedOption) => onChangeValue(index, updatedOption)}
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
