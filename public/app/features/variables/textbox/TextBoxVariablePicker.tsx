import { ChangeEvent, FocusEvent, KeyboardEvent, ReactElement, useCallback, useEffect, useState } from 'react';

import { TextBoxVariableModel, isEmptyObject } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Input } from '@grafana/ui';
import { useDispatch } from 'app/types/store';

import { variableAdapters } from '../adapters';
import { VARIABLE_PREFIX } from '../constants';
import { VariablePickerProps } from '../pickers/types';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { changeVariableProp } from '../state/sharedReducer';
import { toVariablePayload } from '../utils';

export interface Props extends VariablePickerProps<TextBoxVariableModel> {}

export function TextBoxVariablePicker({ variable, onVariableChange, readOnly }: Props): ReactElement {
  const dispatch = useDispatch();
  const [updatedValue, setUpdatedValue] = useState(variable.current.value);
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

    dispatch(
      toKeyedAction(
        variable.rootStateKey,
        changeVariableProp(
          toVariablePayload({ id: variable.id, type: variable.type }, { propName: 'query', propValue: updatedValue })
        )
      )
    );

    if (onVariableChange) {
      onVariableChange({
        ...variable,
        current: isEmptyObject(variable.current) ? {} : { ...variable.current, value: updatedValue },
      });
      return;
    }

    variableAdapters.get(variable.type).updateOptions(variable);
  }, [variable, updatedValue, dispatch, onVariableChange]);

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
      value={updatedValue}
      onChange={onChange}
      onBlur={onBlur}
      disabled={readOnly}
      onKeyDown={onKeyDown}
      placeholder={t('variable.textbox.placeholder', 'Enter variable value')}
      id={VARIABLE_PREFIX + variable.id}
    />
  );
}
