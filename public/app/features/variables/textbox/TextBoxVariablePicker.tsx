import React, { ChangeEvent, FocusEvent, KeyboardEvent, ReactElement, useCallback, useState } from 'react';

import { TextBoxVariableModel } from '../types';
import { toVariablePayload } from '../state/types';
import { changeVariableProp } from '../state/sharedReducer';
import { VariablePickerProps } from '../pickers/types';
import { Input } from '@grafana/ui';
import { variableAdapters } from '../adapters';
import { useDispatch } from 'react-redux';

export interface Props extends VariablePickerProps<TextBoxVariableModel> {}

export function TextBoxVariablePicker({ variable }: Props): ReactElement {
  const {
    id,
    type,
    current: { value },
  } = variable;

  const dispatch = useDispatch();
  const [updatedValue, setUpdatedValue] = useState(value);

  const updateVariable = useCallback(() => {
    if (value === updatedValue) {
      return;
    }

    dispatch(changeVariableProp(toVariablePayload({ id, type }, { propName: 'query', propValue: updatedValue })));
    variableAdapters.get(type).updateOptions(variable);
  }, [dispatch, id, type, value, updatedValue]);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setUpdatedValue(event.target.value), [
    setUpdatedValue,
  ]);

  const onBlur = useCallback((e: FocusEvent<HTMLInputElement>) => updateVariable(), [updateVariable, updatedValue]);
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.keyCode === 13) {
        updateVariable();
      }
    },
    [updateVariable, updatedValue]
  );

  return <Input type="text" value={updatedValue} onChange={onChange} onBlur={onBlur} onKeyDown={onKeyDown} />;
}
