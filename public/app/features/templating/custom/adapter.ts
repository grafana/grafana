import cloneDeep from 'lodash/cloneDeep';

import { containsVariable, QueryVariableModel, VariableRefresh } from '../variable';
import { dispatch } from '../../../store/store';
import {
  setOptionAsCurrent,
  setOptionFromUrl,
  toVariableIdentifier,
  updateVariableQuery,
  toVariablePayload,
} from '../state/actions';
import { VariableAdapter } from '../adapters';
import { initialCustomVariableState, customVariableReducer, ALL_VARIABLE_TEXT } from './reducer';
import { QueryVariablePicker } from '../query/QueryVariablePicker';
import { CustomVariableEditor } from './CustomVariableEditor';

export const createCustomVariableAdapter = (): VariableAdapter<QueryVariableModel> => {
  return {
    description: 'Variable values are fetched from a datasource query',
    label: 'Custom',
    initialState: initialCustomVariableState,
    reducer: customVariableReducer,
    picker: QueryVariablePicker,
    editor: CustomVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return containsVariable(variable.query, variable.datasource, variable.regex, variableToTest.name);
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable, searchFilter) => {
      await dispatch(updateVariableQuery(toVariablePayload(variable)));
    },
    getSaveModel: variable => {
      const { index, uuid, initLock, global, ...rest } = cloneDeep(variable);
      // remove options
      if (variable.refresh !== VariableRefresh.never) {
        return { ...rest, options: [] };
      }

      return rest;
    },
    getValueForUrl: variable => {
      if (variable.current.text === ALL_VARIABLE_TEXT) {
        return ALL_VARIABLE_TEXT;
      }
      return variable.current.value;
    },
  };
};
