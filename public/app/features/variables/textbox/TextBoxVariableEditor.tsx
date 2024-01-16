import React, { FormEvent, ReactElement, useCallback } from 'react';

import { TextBoxVariableForm } from 'app/features/dashboard-scene/settings/variables/components/TextBoxVariableForm';

import { VariableEditorProps } from '../editor/types';
import { TextBoxVariableModel } from '../types';

export interface Props extends VariableEditorProps<TextBoxVariableModel> {}

export function TextBoxVariableEditor({ onPropChange, variable: { query } }: Props): ReactElement {
  const updateVariable = useCallback(
    (event: FormEvent<HTMLInputElement>, updateOptions: boolean) => {
      event.preventDefault();
      onPropChange({ propName: 'originalQuery', propValue: event.currentTarget.value, updateOptions: false });
      onPropChange({ propName: 'query', propValue: event.currentTarget.value, updateOptions });
    },
    [onPropChange]
  );

  const onChange = useCallback((e: FormEvent<HTMLInputElement>) => updateVariable(e, false), [updateVariable]);
  const onBlur = useCallback((e: FormEvent<HTMLInputElement>) => updateVariable(e, true), [updateVariable]);

  return <TextBoxVariableForm value={query} onChange={onChange} onBlur={onBlur} />;
}
