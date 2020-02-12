import { containsVariable, QueryVariableModel, VariableRefresh } from '../variable';
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
    updateOptions: (variable, searchFilter, notifyAngular) => {
      return new Promise(async resolve => {
        await dispatch(updateQueryVariableOptions(variable, searchFilter, notifyAngular));
        resolve();
      });
    },
    getSaveModel: variable => {
      // remove options
      if (variable.refresh !== VariableRefresh.never) {
        variable.options = [];
      }

      const { index, uuid, initLock, global, ...rest } = variable;
      return rest;
    },
  };
};
