import React, { FormEvent, ReactElement, useCallback } from 'react';
import { VerticalGroup } from '@grafana/ui';

import { TextBoxVariableModel } from '../types';
import { VariableEditorProps } from '../editor/types';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { selectors } from '@grafana/e2e-selectors';

export interface Props extends VariableEditorProps<TextBoxVariableModel> {}

export function TextBoxVariableEditor({ onPropChange, variable: { query, placeholder } }: Props): ReactElement {
  const updateDefaultVariable = useCallback(
    (event: FormEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'originalQuery', propValue: event.currentTarget.value, updateOptions: false });
      onPropChange({ propName: 'query', propValue: event.currentTarget.value, updateOptions });
    },
    [onPropChange]
  );

  const updatePlaceholderVariable = useCallback(
    (event: FormEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'placeholder', propValue: event.currentTarget.value, updateOptions });
    },
    [onPropChange]
  );

  const onDefaultChange = useCallback((e: FormEvent<HTMLInputElement>) => updateDefaultVariable(e, false), [
    updateDefaultVariable,
  ]);
  const onDefaultBlur = useCallback((e: FormEvent<HTMLInputElement>) => updateDefaultVariable(e, true), [
    updateDefaultVariable,
  ]);

  const onPlaceholderChange = useCallback((e: FormEvent<HTMLInputElement>) => updatePlaceholderVariable(e, false), [
    updatePlaceholderVariable,
  ]);
  const onPlaceholderBlur = useCallback((e: FormEvent<HTMLInputElement>) => updatePlaceholderVariable(e, false), [
    updatePlaceholderVariable,
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
      <VariableTextField
        value={placeholder ?? ''}
        name="Placeholder"
        placeholder="placeholder for empty field"
        onChange={onPlaceholderChange}
        onBlur={onPlaceholderBlur}
        labelWidth={20}
        grow
        ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.TextBoxVariable.textBoxOptionsQueryInput}
      />
    </VerticalGroup>
  );
}
