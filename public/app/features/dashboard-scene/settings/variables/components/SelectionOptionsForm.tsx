import { ChangeEvent, FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { VariableCheckboxField } from 'app/features/dashboard-scene/settings/variables/components/VariableCheckboxField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';

interface SelectionOptionsFormProps {
  multi: boolean;
  includeAll: boolean;
  allowCustomValue?: boolean;
  allValue?: string | null;
  onMultiChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllowCustomValueChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
}

export function SelectionOptionsForm({
  multi,
  allowCustomValue,
  includeAll,
  allValue,
  onMultiChange,
  onAllowCustomValueChange,
  onIncludeAllChange,
  onAllValueChange,
}: SelectionOptionsFormProps) {
  return (
    <Stack direction="column" gap={2} height="inherit" alignItems="start">
      <VariableCheckboxField
        value={multi}
        name={t('dashboard-scene.selection-options-form.name-multi-value', 'Multi-value')}
        description={t(
          'dashboard-scene.selection-options-form.description-enables-multiple-values-selected',
          'Enables multiple values to be selected at the same time'
        )}
        onChange={onMultiChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch}
      />
      {onAllowCustomValueChange && ( // backwards compat with old arch, remove on cleanup
        <VariableCheckboxField
          value={allowCustomValue ?? true}
          name={t('dashboard-scene.selection-options-form.name-allow-custom-values', 'Allow custom values')}
          description={t(
            'dashboard-scene.selection-options-form.description-enables-users-custom-values',
            'Enables users to add custom values to the list'
          )}
          onChange={onAllowCustomValueChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
        />
      )}
      <VariableCheckboxField
        value={includeAll}
        name={t('dashboard-scene.selection-options-form.name-include-all-option', 'Include All option')}
        description={t(
          'dashboard-scene.selection-options-form.description-enables-option-include-variables',
          'Enables an option to include all values'
        )}
        onChange={onIncludeAllChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch}
      />
      {includeAll && (
        <VariableTextField
          defaultValue={allValue ?? ''}
          onBlur={onAllValueChange}
          name={t('dashboard-scene.selection-options-form.name-custom-all-value', 'Custom all value')}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput}
        />
      )}
    </Stack>
  );
}
