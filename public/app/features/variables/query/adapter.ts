import { cloneDeep } from 'lodash';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { ALL_VARIABLE_TEXT } from '../constants';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { QueryVariableModel, VariableRefresh } from '../types';
import { containsVariable, isAllVariable, toKeyedVariableIdentifier } from '../utils';

import { QueryVariableEditor } from './QueryVariableEditor';
import { updateQueryVariableOptions } from './actions';
import { initialQueryVariableModelState, queryVariableReducer } from './reducer';

export const createQueryVariableAdapter = (): VariableAdapter<QueryVariableModel> => {
  return {
    id: 'query',
    description: 'Variable values are fetched from a datasource query',
    name: 'Query',
    initialState: initialQueryVariableModelState,
    reducer: queryVariableReducer,
    picker: optionPickerFactory<QueryVariableModel>(),
    editor: QueryVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return containsVariable(variable.query, variable.datasource?.uid, variable.regex, variableToTest.name);
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable, searchFilter) => {
      await dispatch(updateQueryVariableOptions(toKeyedVariableIdentifier(variable), searchFilter));
    },
    getSaveModel: (variable) => {
      const { index, id, state, global, queryValue, rootStateKey, ...rest } = cloneDeep(variable);
      // remove options
      if (variable.refresh !== VariableRefresh.never) {
        return { ...rest, options: [] };
      }

      return rest;
    },
    getValueForUrl: (variable) => {
      if (isAllVariable(variable)) {
        return ALL_VARIABLE_TEXT;
      }
      return variable.current.value;
    },
  };
};
