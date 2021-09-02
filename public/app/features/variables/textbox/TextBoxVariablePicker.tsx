import React, { ChangeEvent, FocusEvent, KeyboardEvent, ReactElement, useCallback, useEffect, useState } from 'react';

import { TextBoxVariableModel } from '../types';
import { changeVariableProp } from '../state/sharedReducer';
import { VariablePickerProps } from '../pickers/types';
import { Input } from '@grafana/ui';
import { variableAdapters } from '../adapters';
import { useDispatch } from 'react-redux';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { toVariablePayload } from '../utils';
import { ALL_VARIABLE_VALUE } from '../constants';

export interface Props extends VariablePickerProps<TextBoxVariableModel> {}

export function TextBoxVariablePicker({ variable, onVariableChange }: Props): ReactElement {
  const dispatch = useDispatch();
  const [updatedValue, setUpdatedValue] = useState(variable.current.value);
  const placeholder = variable.placeholder;

  useEffect(() => {
    setUpdatedValue(variable.current.value);
  }, [variable]);

  const updateVariable = useCallback(() => {
    if (!variable.rootStateKey) {
      console.error('Cannot update variable without rootStateKey');
      return;
    }

    if (variable.current.value === updatedValue) {
      return;
    }

    const data = { propName: 'query', propValue: updatedValue };

    if (updatedValue === '') {
      data.propValue = ALL_VARIABLE_VALUE;
    }

    dispatch(
      toKeyedAction(
        variable.rootStateKey,
        changeVariableProp(toVariablePayload({ id: variable.id, type: variable.type }, data))
      )
    );

    if (onVariableChange) {
      onVariableChange({
        ...variable,
        current: { ...variable.current, value: updatedValue },
      });
      return;
    }

    variableAdapters.get(variable.type).updateOptions(variable);
  }, [variable, updatedValue, dispatch, onVariableChange]);

  const checkForOnEmptyValue = () => {
    if (updatedValue !== '' && updatedValue !== ALL_VARIABLE_VALUE) {
      return updatedValue;
    } else {
      return '';
    }
  };

  const valueToDisplay = checkForOnEmptyValue();

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setUpdatedValue(event.target.value),
    [setUpdatedValue]
  );

  const onBlur = (e: FocusEvent<HTMLInputElement>) => updateVariable();
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === 13) {
      event.preventDefault();
      updateVariable();
    }
  };

  return (
    <Input
      type="text"
      value={valueToDisplay ?? ''}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder ?? ''}
      id={variable.id}
    />
  );
}
