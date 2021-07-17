import React, { ReactElement, useCallback, useEffect, useState } from 'react';

import { DateTimeVariableModel } from '../types';
import { toVariablePayload } from '../state/types';
import { changeVariableProp } from '../state/sharedReducer';
import { VariablePickerProps } from '../pickers/types';
import { DatePickerWithInput } from '@grafana/ui';
import { variableAdapters } from '../adapters';
import { useDispatch } from 'react-redux';

export interface Props extends VariablePickerProps<DateTimeVariableModel> {}

export function DateTimeVariablePicker({ variable, onVariableChange }: Props): ReactElement {
  const dispatch = useDispatch();
  const [date, setDate] = useState<Date | string>(new Date(+variable.current.value));
  useEffect(() => {
    setDate(new Date(+variable.current.value));
  }, [variable]);
  const updateVariable = useCallback(
    (value: string | Date) => {
      dispatch(
        changeVariableProp(
          toVariablePayload(
            { id: variable.id, type: variable.type },
            { propName: 'query', propValue: value.valueOf().toString() }
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

  const onChange = (value: string | Date) => {
    setDate(value);
    updateVariable(value);
  };

  return <DatePickerWithInput value={date} onChange={onChange} />;
}
