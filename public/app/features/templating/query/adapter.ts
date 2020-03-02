import cloneDeep from 'lodash/cloneDeep';

import { containsVariable, QueryVariableModel, VariableRefresh } from '../variable';
import { initialQueryVariableState, queryVariableReducer } from './reducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl, toVariableIdentifier } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { VariableOptionsPicker } from '../pickers';
import { QueryVariableEditor } from './QueryVariableEditor';
import { updateQueryVariableOptions } from './actions';
import { ALL_VARIABLE_TEXT } from '../state/types';

export const createQueryVariableAdapter = (): VariableAdapter<QueryVariableModel> => {
  return {
    description: 'Variable values are fetched from a datasource query',
    label: 'Query',
    initialState: initialQueryVariableState,
    reducer: queryVariableReducer,
    picker: VariableOptionsPicker,
    editor: QueryVariableEditor,
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
      await dispatch(updateQueryVariableOptions(toVariableIdentifier(variable), searchFilter));
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
