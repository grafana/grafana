import { cloneDeep } from 'lodash';

import { CustomVariableModel } from '@grafana/data';
import { t } from '@grafana/i18n';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { ALL_VARIABLE_TEXT } from '../constants';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { containsVariable, isAllVariable, toKeyedVariableIdentifier } from '../utils';

import { CustomVariableEditor } from './CustomVariableEditor';
import { updateCustomVariableOptions } from './actions';
import { customVariableReducer, initialCustomVariableModelState } from './reducer';

export const createCustomVariableAdapter = (): VariableAdapter<CustomVariableModel> => {
  return {
    id: 'custom',
    description: t(
      'variables.create-custom-variable-adapter.description.define-variable-values-manually',
      'Define variable values manually'
    ),
    name: 'Custom',
    initialState: initialCustomVariableModelState,
    reducer: customVariableReducer,
    picker: optionPickerFactory<CustomVariableModel>(),
    editor: CustomVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return containsVariable(variable.query, variableToTest.name);
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateCustomVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable) => {
      const { index, id, state, global, rootStateKey, ...rest } = cloneDeep(variable);
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
