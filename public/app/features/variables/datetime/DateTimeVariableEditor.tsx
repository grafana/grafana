import React, { FormEvent, ReactElement, useCallback } from 'react';

import { DateTimeVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';

export interface Props extends VariableEditorProps<DateTimeVariableModel> {}

export const DateTimeVariableEditor = ({ onPropChange, variable: { allValue } }: Props): ReactElement => {
  const updateAllVariable = useCallback(
    (event: FormEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'allValue', propValue: event.currentTarget.value, updateOptions });
    },
    [onPropChange]
  );

  const onAllChange = useCallback((e: FormEvent<HTMLInputElement>) => updateAllVariable(e, true), [updateAllVariable]);
  const onAllBlur = useCallback((e: FormEvent<HTMLInputElement>) => updateAllVariable(e, false), [updateAllVariable]);

  return (
    <VerticalGroup spacing="xs">
      <VariableSectionHeader name="Date options" />
      <VariableTextField
        value={allValue ?? ''}
        name="No Date Input Value"
        placeholder="value if date input is disabled"
        onChange={onAllChange}
        onBlur={onAllBlur}
        labelWidth={20}
        grow
        ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInput}
      />
    </VerticalGroup>
  );
};
