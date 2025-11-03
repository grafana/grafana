import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Field, Combobox, Input, type ComboboxOption, Stack } from '@grafana/ui';

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
  const [enabledValueInvalid, setEnabledValueInvalid] = useState<boolean>(false);
  const [disabledValueInvalid, setDisabledValueInvalid] = useState<boolean>(false);
  const identicalValuesErrorMessage = t(
    'dashboard-scene.switch-variable-form.same-values-error',
    'Enabled and disabled values cannot be the same'
  );

  const onValuePairTypeChange = (selection: ComboboxOption<string> | null) => {
    if (!selection?.value) {
      return;
    }

    setEnabledValueInvalid(false);
    setDisabledValueInvalid(false);

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

  const handleEnabledValueChange = (newEnabledValue: string) => {
    const isInvalid = newEnabledValue === disabledValue;

    setEnabledValueInvalid(isInvalid);
    setDisabledValueInvalid(false);

    if (!isInvalid) {
      onEnabledValueChange(newEnabledValue);
    }
  };

  const handleDisabledValueChange = (newDisabledValue: string) => {
    const isInvalid = newDisabledValue === enabledValue;

    setDisabledValueInvalid(isInvalid);
    setEnabledValueInvalid(false);

    if (!isInvalid) {
      onDisabledValueChange(newDisabledValue);
    }
  };

  return (
    <>
      <VariableLegend>
        <Trans i18nKey="dashboard-scene.switch-variable-form.switch-options">Switch options</Trans>
      </VariableLegend>

      <Stack gap={2} direction="column">
        <Field
          noMargin
          label={t('dashboard-scene.switch-variable-form.value-pair-type', 'Value pair type')}
          description={t(
            'dashboard-scene.switch-variable-form.value-pair-type-description',
            'Choose the type of values for the switch states'
          )}
        >
          <Combobox
            width={40}
            value={isCustomValuePairType ? 'custom' : currentValuePairType}
            options={VALUE_PAIR_OPTIONS}
            onChange={onValuePairTypeChange}
            data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.valuePairTypeSelect}
          />
        </Field>

        {/* Custom value pair type */}
        {isCustomValuePairType && (
          <Stack gap={2} direction="column">
            <Field
              noMargin
              label={t('dashboard-scene.switch-variable-form.enabled-value', 'Enabled value')}
              description={t(
                'dashboard-scene.switch-variable-form.enabled-value-description',
                'Value when switch is enabled'
              )}
              error={enabledValueInvalid && identicalValuesErrorMessage}
              invalid={enabledValueInvalid}
            >
              <Input
                width={40}
                defaultValue={enabledValue}
                onChange={(event) => {
                  handleEnabledValueChange(event.currentTarget.value);
                }}
                placeholder={t(
                  'dashboard-scene.switch-variable-form.enabled-value-placeholder',
                  'e.g. On, Enabled, Active'
                )}
                data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.enabledValueInput}
              />
            </Field>

            <Field
              noMargin
              label={t('dashboard-scene.switch-variable-form.disabled-value', 'Disabled value')}
              description={t(
                'dashboard-scene.switch-variable-form.disabled-value-description',
                'Value when switch is disabled'
              )}
              error={disabledValueInvalid && identicalValuesErrorMessage}
              invalid={disabledValueInvalid}
            >
              <Input
                width={40}
                defaultValue={disabledValue}
                onChange={(event) => handleDisabledValueChange(event.currentTarget.value)}
                placeholder={t(
                  'dashboard-scene.switch-variable-form.disabled-value-placeholder',
                  'e.g. Off, Disabled, Inactive'
                )}
                data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.SwitchVariable.disabledValueInput}
              />
            </Field>
          </Stack>
        )}
      </Stack>
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
