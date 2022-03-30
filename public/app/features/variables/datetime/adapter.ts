import { cloneDeep } from 'lodash';

import { DateTimeVariableModel } from '../types';
import { initialDateTimeVariableModelState, dateTimeVariableReducer } from './reducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { DateTimeVariableEditor } from './DateTimeVariableEditor';
import { DateTimeVariablePicker } from './DateTimeVariablePicker';
import { updateDateTimeVariableOptions, setDateTimeVariableOptionsFromUrl } from './actions';
import { toKeyedVariableIdentifier } from '../utils';
import { ALL_VARIABLE_VALUE } from '../constants';

export const createDateTimeVariableAdapter = (): VariableAdapter<DateTimeVariableModel> => {
  return {
    id: 'datetime',
    description: 'Define a datetime with a datepicker',
    name: 'DateTime',
    initialState: initialDateTimeVariableModelState,
    reducer: dateTimeVariableReducer,
    picker: DateTimeVariablePicker,
    editor: DateTimeVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      if (urlValue) {
        if (isNaN(new Date(+urlValue).getTime())) {
          urlValue = ALL_VARIABLE_VALUE;
        }
      }

      await dispatch(setDateTimeVariableOptionsFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateDateTimeVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable) => {
      const { index, id, state, global, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: (variable) => {
      return variable.current.value;
    },
  };
};
