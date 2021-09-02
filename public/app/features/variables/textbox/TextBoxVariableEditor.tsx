import React, { FormEvent, ReactElement, useCallback } from 'react';
import { VerticalGroup } from '@grafana/ui';

import { TextBoxVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { selectors } from '@grafana/e2e-selectors';

export interface Props extends VariableEditorProps<TextBoxVariableModel> {}

export function TextBoxVariableEditor({ onPropChange, variable: { query } }: Props): ReactElement {
  const updateDefaultVariable = useCallback(
    (event: FormEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'originalQuery', propValue: event.currentTarget.value, updateOptions: false });
      onPropChange({ propName: 'query', propValue: event.currentTarget.value, updateOptions });
    },
    [onPropChange]
  );

  const onDefaultChange = useCallback((e: FormEvent<HTMLInputElement>) => updateDefaultVariable(e, false), [
    updateDefaultVariable,
  ]);
  const onDefaultBlur = useCallback((e: FormEvent<HTMLInputElement>) => updateDefaultVariable(e, true), [
    updateDefaultVariable,
  ]);

  return (
    <VerticalGroup spacing="xs">
      <VariableSectionHeader name="Text options" />
      <VariableTextField
        value={query}
        name="Default value"
        placeholder="default value, if any"
        onChange={onDefaultChange}
        onBlur={onDefaultBlur}
        labelWidth={20}
        grow
        testId={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInputV2}
      />
    </VerticalGroup>
  );
}
