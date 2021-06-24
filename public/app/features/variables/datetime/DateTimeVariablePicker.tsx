import React, { ReactElement, useCallback, useEffect, useState } from 'react';

import { DateTimeVariableModel } from '../types';
import { toVariablePayload } from '../utils';
import { changeVariableProp } from '../state/sharedReducer';
import { VariablePickerProps } from '../pickers/types';
import { DatePickerWithEmptyWithInput } from '@grafana/ui';
import { variableAdapters } from '../adapters';
import { useDispatch } from 'react-redux';
import { ALL_VARIABLE_VALUE } from '../constants';

export interface Props extends VariablePickerProps<DateTimeVariableModel> {}

export function DateTimeVariablePicker({ variable, onVariableChange }: Props): ReactElement {
  const dispatch = useDispatch();
  const [date, setDate] = useState<Date | string>(() => {
    const currentValue = variable.current.value;
    if (currentValue === ALL_VARIABLE_VALUE) {
      return ALL_VARIABLE_VALUE;
    }
    return new Date(+currentValue);
  });
  const [isDateInput, setIsDateInput] = useState(true);

  useEffect(() => {
    if (variable.current.value !== ALL_VARIABLE_VALUE) {
      setDate(new Date(+variable.current.value));
      setIsDateInput(true);
    } else {
      setDate(new Date());
      setIsDateInput(false);
    }
  }, [variable]);

  const updateVariable = useCallback(
    (value: Date, isDateInput: boolean) => {
      dispatch(
        changeVariableProp(
          toVariablePayload(
            { id: variable.id, type: variable.type },
            { propName: 'query', propValue: isDateInput ? value.valueOf().toString() : ALL_VARIABLE_VALUE }
          )
        )
      );

      if (onVariableChange) {
        onVariableChange({
          ...variable,
          current: { ...variable.current, value: value.valueOf().toString() },
        });
        return;
      }

      variableAdapters.get(variable.type).updateOptions(variable);
    },
    [dispatch, variable, onVariableChange]
  );

  const onChange = (value: Date, isDateInput: boolean) => {
    setDate(value);
    setIsDateInput(isDateInput);
    updateVariable(value, isDateInput);
  };

  return <DatePickerWithEmptyWithInput value={date} onChange={onChange} isDateInput={isDateInput} />;
}
