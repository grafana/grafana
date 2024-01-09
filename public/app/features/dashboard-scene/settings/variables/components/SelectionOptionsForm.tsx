import React, { ChangeEvent, FormEvent } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { VerticalGroup } from '@grafana/ui';
import { VariableCheckboxField } from 'app/features/variables/editor/VariableCheckboxField';
import { VariableTextField } from 'app/features/variables/editor/VariableTextField';

interface SelectionOptionsFormProps {
  multi: boolean;
  includeAll: boolean;
  allValue?: string | null;
  onMultiChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onIncludeAllChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAllValueChange: (event: FormEvent<HTMLInputElement>) => void;
}

export function SelectionOptionsForm({
  multi,
  includeAll,
  allValue,
  onMultiChange,
  onIncludeAllChange,
  onAllValueChange,
}: SelectionOptionsFormProps) {
  return (
    <VerticalGroup spacing="md" height="inherit">
      <VariableCheckboxField
        value={multi}
        name="Multi-value"
        description="Enables multiple values to be selected at the same time"
        onChange={onMultiChange}
      />
      <VariableCheckboxField
        value={includeAll}
        name="Include All option"
        description="Enables an option to include all variables"
        onChange={onIncludeAllChange}
      />
      {includeAll && (
        <VariableTextField
          value={allValue ?? ''}
          onChange={onAllValueChange}
          name="Custom all value"
          placeholder="blank = auto"
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2}
        />
      )}
    </VerticalGroup>
  );
}
