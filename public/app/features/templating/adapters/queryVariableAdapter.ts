import { containsVariable, QueryVariableModel, VariableRefresh } from '../variable';
import { ALL_VARIABLE_TEXT, initialQueryVariableState, queryVariableReducer } from '../state/queryVariableReducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from './index';
import { QueryVariablePicker } from '../picker/QueryVariablePicker';
import { QueryVariableEditor } from '../editor/QueryVariableEditor';
import { updateQueryVariableOptions } from '../state/queryVariableActions';

export const createQueryVariableAdapter = (): VariableAdapter<QueryVariableModel> => {
  return {
    description: 'Variable values are fetched from a datasource query',
    initialState: initialQueryVariableState,
    reducer: queryVariableReducer,
    picker: QueryVariablePicker,
    editor: QueryVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return containsVariable(variable.query, variable.datasource, variable.regex, variableToTest.name);
    },
    setValue: async (variable, option) => {
      await dispatch(setOptionAsCurrent(variable, option));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(variable, urlValue));
    },
    updateOptions: async (variable, searchFilter, notifyAngular) => {
      await dispatch(updateQueryVariableOptions(variable, searchFilter, notifyAngular));
    },
    getSaveModel: variable => {
      const { index, uuid, initLock, global, ...rest } = variable;
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
