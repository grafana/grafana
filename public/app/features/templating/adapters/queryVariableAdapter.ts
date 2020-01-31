import { containsVariable, QueryVariableModel } from '../variable';
import { queryVariableReducer, QueryVariableState } from '../state/queryVariableReducer';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from './index';
import { QueryVariablePicker } from '../picker/QueryVariablePicker';
import { QueryVariableEditor } from '../editor/QueryVariableEditor';
import { updateQueryVariableOptions } from '../state/queryVariableActions';

export const createQueryVariableAdapter = (): VariableAdapter<QueryVariableModel, QueryVariableState> => {
  return {
    description: 'Variable values are fetched from a datasource query',
    reducer: queryVariableReducer,
    picker: QueryVariablePicker,
    editor: QueryVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return containsVariable(variable.query, variable.datasource, variable.regex, variableToTest.name);
    },
    setValue: async (variable, option) => {
      return new Promise(async resolve => {
        await dispatch(setOptionAsCurrent(variable, option));
        resolve();
      });
    },
    setValueFromUrl: async (variable, urlValue) => {
      return new Promise(async resolve => {
        await dispatch(setOptionFromUrl(variable, urlValue));
        resolve();
      });
    },
    updateOptions: (variable, searchFilter) => {
      return new Promise(async resolve => {
        await dispatch(updateQueryVariableOptions(variable, searchFilter, false));
        resolve();
      });
    },
    onEditorUpdate: variable => {
      return new Promise(async resolve => {
        await dispatch(updateQueryVariableOptions(variable, undefined, true));
        resolve();
      });
    },
  };
};
