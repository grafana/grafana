import cloneDeep from 'lodash/cloneDeep';
import { DataSourceVariableModel } from '../types';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { dataSourceVariableReducer, initialDataSourceVariableModelState } from './reducer';
import { OptionsPicker } from '../pickers';
import { ALL_VARIABLE_TEXT, toVariableIdentifier } from '../state/types';
import { DataSourceVariableEditor } from './DataSourceVariableEditor';
import { updateDataSourceVariableOptions } from './actions';
import { containsVariable } from '../utils';

export const createDataSourceVariableAdapter = (): VariableAdapter<DataSourceVariableModel> => {
  return {
    id: 'datasource',
    description: 'Enabled you to dynamically switch the datasource for multiple panels',
    name: 'Datasource',
    initialState: initialDataSourceVariableModelState,
    reducer: dataSourceVariableReducer,
    picker: OptionsPicker,
    editor: DataSourceVariableEditor,
    dependsOn: (variable, variableToTest) => {
      if (variable.regex) {
        return containsVariable(variable.regex, variableToTest.name);
      }
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toVariableIdentifier(variable), urlValue));
    },
    updateOptions: async variable => {
      await dispatch(updateDataSourceVariableOptions(toVariableIdentifier(variable)));
    },
    getSaveModel: variable => {
      const { index, id, initLock, global, ...rest } = cloneDeep(variable);
      return { ...rest, options: [] };
    },
    getValueForUrl: variable => {
      if (variable.current.text === ALL_VARIABLE_TEXT) {
        return ALL_VARIABLE_TEXT;
      }
      return variable.current.value;
    },
  };
};
