import React, { ChangeEvent, FormEvent, useCallback } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { VerticalGroup } from '@grafana/ui';

import { KeyedVariableIdentifier } from '../state/types';
import { VariableWithMultiSupport } from '../types';
import { toKeyedVariableIdentifier } from '../utils';

import { VariableCheckboxField } from './VariableCheckboxField';
import { VariableTextField } from './VariableTextField';
import { VariableEditorProps } from './types';

export interface SelectionOptionsEditorProps<Model extends VariableWithMultiSupport = VariableWithMultiSupport>
  extends VariableEditorProps<Model> {
  onMultiChanged: (identifier: KeyedVariableIdentifier, value: boolean) => void;
}

export const SelectionOptionsEditor = ({
  onMultiChanged: onMultiChangedProps,
  onPropChange,
  variable,
}: SelectionOptionsEditorProps) => {
  const onMultiChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onMultiChangedProps(toKeyedVariableIdentifier(variable), event.target.checked);
    },
    [onMultiChangedProps, variable]
  );

  const onIncludeAllChanged = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onPropChange({ propName: 'includeAll', propValue: event.target.checked });
    },
    [onPropChange]
  );

  const onAllValueChanged = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onPropChange({ propName: 'allValue', propValue: event.currentTarget.value });
    },
    [onPropChange]
  );

  return (
    <VerticalGroup spacing="md" height="inherit">
      <VariableCheckboxField
        value={variable.multi}
        name="Multi-value"
        description="Enables multiple values to be selected at the same time"
        onChange={onMultiChanged}
      />
      <VariableCheckboxField
        value={variable.includeAll}
        name="Include All option"
        description="Enables an option to include all variables"
        onChange={onIncludeAllChanged}
      />
      {variable.includeAll && (
        <VariableTextField
          value={variable.allValue ?? ''}
          onChange={onAllValueChanged}
          name="Custom all value"
          placeholder="blank = auto"
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsCustomAllInputV2}
        />
      )}
    </VerticalGroup>
  );
};
SelectionOptionsEditor.displayName = 'SelectionOptionsEditor';
