import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Field, Combobox, Input, type ComboboxOption } from '@grafana/ui';

import { VariableLegend } from './VariableLegend';

interface SwitchVariableFormProps {
  enabledValue: string;
  disabledValue: string;
  onEnabledValueChange: (value: string) => void;
  onDisabledValueChange: (value: string) => void;
}

const VALUE_PAIR_OPTIONS: Array<ComboboxOption<string>> = [
  { label: 'True / False', value: 'boolean' },
  { label: '1 / 0', value: 'number' },
  { label: 'Yes / No', value: 'string' },
  { label: 'Custom', value: 'custom' },
];

export function SwitchVariableForm({
  enabledValue,
  disabledValue,
  onEnabledValueChange,
  onDisabledValueChange,
}: SwitchVariableFormProps) {
  const currentValuePairType = getCurrentValuePairType(enabledValue, disabledValue);
  const [isCustomValuePairType, setIsCustomValuePairType] = useState(currentValuePairType === 'custom');

  const onValuePairTypeChange = (selection: ComboboxOption<string> | null) => {
    if (!selection?.value) {
      return;
    }

    switch (selection.value) {
      case 'boolean':
        onEnabledValueChange('true');
        onDisabledValueChange('false');
        setIsCustomValuePairType(false);
        break;
      case 'number':
        onEnabledValueChange('1');
        onDisabledValueChange('0');
        setIsCustomValuePairType(false);
        break;
      case 'string':
        onEnabledValueChange('yes');
        onDisabledValueChange('no');
        setIsCustomValuePairType(false);
        break;
      case 'custom':
        setIsCustomValuePairType(true);
        break;
    }
  };

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.switch-variable-form.switch-options">Switch options</Trans>
      </VariableLegend>

      <Field
        label={t('dashboard-scene.switch-variable-form.value-pair-type', 'Value pair type')}
        description={t(
          'dashboard-scene.switch-variable-form.value-pair-type-description',
          'Choose the type of values for the switch states'
        )}
      >
        <Combobox
          width={40}
          value={currentValuePairType}
          options={VALUE_PAIR_OPTIONS}
          onChange={onValuePairTypeChange}
          data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect}
        />
      </Field>

      {/* Custom value pair type */}
      {isCustomValuePairType && (
        <>
          <Field
            label={t('dashboard-scene.switch-variable-form.enabled-value', 'Enabled value')}
            description={t(
              'dashboard-scene.switch-variable-form.enabled-value-description',
              'Value when switch is enabled'
            )}
          >
            <Input
              width={40}
              value={enabledValue}
              onChange={(event) => {
                onEnabledValueChange(event.currentTarget.value);
              }}
              placeholder={t(
                'dashboard-scene.switch-variable-form.enabled-value-placeholder',
                'e.g. On, Enabled, Active'
              )}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput}
            />
          </Field>

          <Field
            label={t('dashboard-scene.switch-variable-form.disabled-value', 'Disabled value')}
            description={t(
              'dashboard-scene.switch-variable-form.disabled-value-description',
              'Value when switch is disabled'
            )}
          >
            <Input
              width={40}
              value={disabledValue}
              onChange={(event) => onDisabledValueChange(event.currentTarget.value)}
              placeholder={t(
                'dashboard-scene.switch-variable-form.disabled-value-placeholder',
                'e.g. Off, Disabled, Inactive'
              )}
              data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput}
            />
          </Field>
        </>
      )}
    </>
  );
}

function getCurrentValuePairType(enabledValue: string, disabledValue: string) {
  if (enabledValue === 'true' && disabledValue === 'false') {
    return 'boolean';
  }
  if (enabledValue === '1' && disabledValue === '0') {
    return 'number';
  }
  if (enabledValue === 'yes' && disabledValue === 'no') {
    return 'string';
  }
  return 'custom';
}
