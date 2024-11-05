import { ChangeEvent, FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/ui';
import { VariableCheckboxField } from 'app/features/dashboard-scene/settings/variables/components/VariableCheckboxField';
import { VariableTextField } from 'app/features/dashboard-scene/settings/variables/components/VariableTextField';

interface SelectionOptionsFormProps {
  multi: boolean;
  includeAll: boolean;
  disallowCustomValues?: boolean;
  allValue?: string | null;
  onMultiChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDisallowCustomValuesChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
}

export function SelectionOptionsForm({
  multi,
  disallowCustomValues,
  includeAll,
  allValue,
  onMultiChange,
  onDisallowCustomValuesChange,
  onIncludeAllChange,
  onAllValueChange,
}: SelectionOptionsFormProps) {
  return (
    <Stack direction="column" gap={2} height="inherit" alignItems="start">
      <VariableCheckboxField
        value={multi}
        name="Multi-value"
        description="Enables multiple values to be selected at the same time"
        onChange={onMultiChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch}
      />
      {disallowCustomValues !== undefined && onDisallowCustomValuesChange && (
        <VariableCheckboxField
          value={disallowCustomValues}
          name="Disallow custom values"
          description="Locks the list of values to the ones defined in the query"
          onChange={onDisallowCustomValuesChange}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsMultiSwitch}
        />
      )}
      <VariableCheckboxField
        value={includeAll}
        name="Include All option"
        description="Enables an option to include all variables"
        onChange={onIncludeAllChange}
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch}
      />
      {includeAll && (
        <VariableTextField
          defaultValue={allValue ?? ''}
          onBlur={onAllValueChange}
          name="Custom all value"
          placeholder="blank = auto"
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInput}
        />
      )}
    </Stack>
  );
}
