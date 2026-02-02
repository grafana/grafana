import { cloneDeep } from 'lodash';

import { DatePickerVariableModel } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { setOptionAsCurrent } from '../state/actions';
import { toKeyedVariableIdentifier } from '../utils';

import { DatePickerVariableEditor } from './DatePickerVariableEditor';
import { DatePickerVariablePicker } from './DatePickerVariablePicker';
import { setDatePickerVariableOptionsFromUrl, updateDatePickerVariableOptions } from './actions';
import { initialDatePickerVariableModelState, DatePickerVariableReducer } from './reducer';

export const createDatePickerVariableAdapter = (): VariableAdapter<DatePickerVariableModel> => {
  return {
    id: 'datepicker',
    description: t(
      'bmc.date-picker.description',
      'Define a date range variable, where users can select any date range'
    ),
    name: t('bmc.date-picker.name', 'Date Range'),
    initialState: initialDatePickerVariableModelState,
    reducer: DatePickerVariableReducer,
    picker: DatePickerVariablePicker,
    editor: DatePickerVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setDatePickerVariableOptionsFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateDatePickerVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable, saveCurrentAsDefault) => {
      const { index, id, state, global, originalQuery, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: (variable) => {
      return variable.current.value;
    },
    beforeAdding: (model) => {
      return { ...cloneDeep(model), originalQuery: model.query };
    },
  };
};
