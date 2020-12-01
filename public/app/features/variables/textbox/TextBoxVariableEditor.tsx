import React, { ChangeEvent, ReactElement, useCallback } from 'react';
import { VerticalGroup } from '@grafana/ui';

import { TextBoxVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { selectors } from '@grafana/e2e-selectors';

export interface Props extends VariableEditorProps<TextBoxVariableModel> {}

export function TextBoxVariableEditor({ onPropChange, variable: { query } }: Props): ReactElement {
  const updateVariable = useCallback(
    (event: ChangeEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'originalQuery', propValue: event.target.value, updateOptions: false });
      onPropChange({ propName: 'query', propValue: event.target.value, updateOptions });
    },
    [onPropChange]
  );

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => updateVariable(e, false), [updateVariable]);
  const onBlur = useCallback((e: ChangeEvent<HTMLInputElement>) => updateVariable(e, true), [updateVariable]);

  return (
    <VerticalGroup spacing="xs">
      <VariableSectionHeader name="Text Options" />
      <VariableTextField
        value={query}
        name="Default value"
        placeholder="default value, if any"
        onChange={onChange}
        onBlur={onBlur}
        labelWidth={20}
        grow
        ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInput}
      />
    </VerticalGroup>
  );
}
