import { cloneDeep } from 'lodash';

import { DataSourceVariableModel } from '@grafana/data';
import { t } from 'app/core/internationalization';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { ALL_VARIABLE_TEXT } from '../constants';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { containsVariable, isAllVariable, toKeyedVariableIdentifier } from '../utils';

import { DataSourceVariableEditor } from './DataSourceVariableEditor';
import { updateDataSourceVariableOptions } from './actions';
import { dataSourceVariableReducer, initialDataSourceVariableModelState } from './reducer';

// BMC Change: To enable localization for below text
export const createDataSourceVariableAdapter = (): VariableAdapter<DataSourceVariableModel> => {
  return {
    id: 'datasource',
    description: t(
      'bmcgrafana.dashboards.settings.variables.editor.select-variable-type.data-source.description',
      'Enables you to dynamically switch the data source for multiple panels.'
    ),
    name: t('bmcgrafana.dashboards.settings.variables.editor.select-variable-type.data-source.name', 'Data source'),
    initialState: initialDataSourceVariableModelState,
    reducer: dataSourceVariableReducer,
    picker: optionPickerFactory<DataSourceVariableModel>(),
    editor: DataSourceVariableEditor,
    dependsOn: (variable, variableToTest) => {
      if (variable.regex) {
        return containsVariable(variable.regex, variableToTest.name);
      }
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateDataSourceVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable) => {
      const { index, id, state, global, rootStateKey, ...rest } = cloneDeep(variable);
      return { ...rest, options: [] };
    },
    getValueForUrl: (variable) => {
      if (isAllVariable(variable)) {
        return ALL_VARIABLE_TEXT;
      }
      return variable.current.value;
    },
  };
};
