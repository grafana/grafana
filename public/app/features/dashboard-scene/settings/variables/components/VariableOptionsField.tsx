import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { VariableValueOption } from '@grafana/scenes';
import { Button, Field, Input, Stack } from '@grafana/ui';

interface VariableOptionsFieldProps {
  options: VariableValueOption[];
  onChange: (options: VariableValueOption[]) => void;
  width?: number;
}

export function VariableOptionsField({ options, onChange, width }: VariableOptionsFieldProps) {
  const [optionsLocal, setOptionsLocal] = useState(options.length ? options : [{ value: '', label: '' }]);

  const updateOptions = (newOptions: VariableValueOption[]) => {
    setOptionsLocal(newOptions);
    onChange(
      optionsLocal
        .map((option) => ({
          label: option.label.trim(),
          value: String(option.value).trim(),
        }))
        .filter((option) => !!option.label)
    );
  };

  const handleValueChange = (index: number, value: string) => {
    if (optionsLocal[index].value !== value) {
      const newOptions = [...optionsLocal];
      newOptions[index] = { ...newOptions[index], value };
      updateOptions(newOptions);
    }
  };

  const handleLabelChange = (index: number, label: string) => {
    if (optionsLocal[index].label !== label) {
      const newOptions = [...optionsLocal];
      newOptions[index] = { ...newOptions[index], label };
      updateOptions(newOptions);
    }
  };

  const addOption = () => {
    const newOption: VariableValueOption = { value: '', label: '' };
    const newOptions = [...optionsLocal, newOption];
    updateOptions(newOptions);
  };

  const removeOption = (index: number) => {
    const newOptions = optionsLocal.filter((_, i) => i !== index);
    updateOptions(newOptions);
  };

  return (
    <Field
      label={t('variables.query-variable-static-options.field-label', 'Options')}
      description={t(
        'variables.query-variable-static-options.description',
        'Options to be added in addition to query results'
      )}
    >
      <Stack direction="column" gap={2} width={width}>
        {optionsLocal.map((option, index) => (
          <Stack direction="row" key={index}>
            <Input
              value={option.label}
              placeholder={t('variables.query-variable-static-options.label-placeholder', 'display label')}
              onChange={(e) => handleLabelChange(index, e.currentTarget.value)}
            />
            <Input
              value={String(option.value)}
              placeholder={t(
                'variables.query-variable-static-options.value-placeholder',
                'value, default empty string'
              )}
              onChange={(e) => handleValueChange(index, e.currentTarget.value)}
            />
            <Button
              icon="times"
              variant="secondary"
              aria-label={t('variables.query-variable-static-options.remove-option-button-label', 'Remove option')}
              onClick={() => removeOption(index)}
            />
          </Stack>
        ))}
        <div>
          <Button
            icon="plus"
            variant="secondary"
            onClick={addOption}
            aria-label={t('variables.query-variable-static-options.add-option-button-label', 'Add option')}
          >
            <Trans i18nKey="variables.query-variable-static-options.add-option-button-label">Add option</Trans>
          </Button>
        </div>
      </Stack>
    </Field>
  );
}
