import { type ChangeEvent, type FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { VariableCheckboxField } from 'app/features/dashboard-scene/settings/variables/components/VariableCheckboxField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';

interface SelectionOptionsFormProps {
  multi: boolean;
  includeAll: boolean;
  allowCustomValue?: boolean;
  disableAllowCustomValue?: boolean;
  allValue?: string | null;
  disableCustomAllValue?: boolean;
  onMultiChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllowCustomValueChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
}

export function SelectionOptionsForm({
  multi,
  allowCustomValue,
  disableAllowCustomValue,
  includeAll,
  allValue,
  disableCustomAllValue,
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
      <VariableCheckboxField
        value={includeAll}
        name={t('dashboard.edit-pane.variable.selection-options.include-all', 'Include All value')}
        description={t(
          'dashboard.edit-pane.variable.selection-options.include-all-description',
          'Enables a single option that represent all values'
        )}
        onChange={onIncludeAllChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch}
      />
      {!disableCustomAllValue && includeAll && (
        <VariableTextField
          defaultValue={allValue ?? ''}
          onBlur={onAllValueChange}
          name={t('dashboard.edit-pane.variable.selection-options.custom-all-value', 'Custom all value')}
          description={t(
            'dashboard.edit-pane.variable.selection-options.custom-all-value-description',
            'A wildcard regex or other value to represent All'
          )}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput}
        />
      )}
      {!disableAllowCustomValue &&
        onAllowCustomValueChange && ( // backwards compat with old arch, remove on cleanup
          <VariableCheckboxField
            value={allowCustomValue ?? true}
            name={t('dashboard.edit-pane.variable.selection-options.allow-custom-values', 'Allow custom values')}
            description={t(
              'dashboard.edit-pane.variable.selection-options.allow-custom-values-description',
              'Enables users to enter values'
            )}
            onChange={onAllowCustomValueChange}
            testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsAllowCustomValueSwitch}
          />
        )}
    </Stack>
  );
}
