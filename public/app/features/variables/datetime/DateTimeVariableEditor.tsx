import React, { ChangeEvent, FormEvent, ReactElement, useCallback } from 'react';

import { DateTimeVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSwitchField } from '../editor/VariableSwitchField';

export interface Props extends VariableEditorProps<DateTimeVariableModel> {}

export const DateTimeVariableEditor = ({ onPropChange, variable: { allValue, returnValue } }: Props): ReactElement => {
  const updateAllVariable = useCallback(
    (event: FormEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'allValue', propValue: event.currentTarget.value, updateOptions });
    },
    [onPropChange]
  );

  const updateReturnValueVariable = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onPropChange({
        propName: 'returnValue',
        propValue: event.currentTarget.checked ? 'end' : 'start',
        updateOptions: true,
      });
    },
    [onPropChange]
  );

  const onAllChange = useCallback((e: FormEvent<HTMLInputElement>) => updateAllVariable(e, true), [updateAllVariable]);
  const onAllBlur = useCallback((e: FormEvent<HTMLInputElement>) => updateAllVariable(e, false), [updateAllVariable]);

  const onReturnValueChanged = useCallback((e: ChangeEvent<HTMLInputElement>) => updateReturnValueVariable(e), [
    updateReturnValueVariable,
  ]);

  return (
    <VerticalGroup spacing="none">
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

      <InlineFieldRow>
        <VariableSwitchField
          value={returnValue === 'end'}
          name="Use end of the day"
          tooltip="Return the end of the selected day instead of its start"
          onChange={onReturnValueChanged}
          ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.General.selectionOptionsIncludeAllSwitch}
        />
      </InlineFieldRow>
    </VerticalGroup>
  );
};
