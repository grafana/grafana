import { cloneDeep } from 'lodash';

import { SwitchVariableModel } from '@grafana/data';
import { t } from '@grafana/i18n';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { containsVariable, toKeyedVariableIdentifier } from '../utils';

import { SwitchVariableEditor } from './SwitchVariableEditor';
import { SwitchVariablePicker } from './SwitchVariablePicker';
import { switchVariableReducer, initialSwitchVariableModelState } from './reducer';

export const createSwitchVariableAdapter = (): VariableAdapter<SwitchVariableModel> => {
  return {
    id: 'switch',
    description: t('variables.create-switch-variable-adapter.description', 'A variable that can be toggled on and off'),
    name: 'Switch',
    initialState: initialSwitchVariableModelState,
    reducer: switchVariableReducer,
    picker: SwitchVariablePicker,
    editor: SwitchVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return containsVariable(variable.query, variableToTest.name);
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async () => {},
    getSaveModel: (variable) => {
      const { index, id, state, global, rootStateKey, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: (variable) => {
      return variable.current.value;
    },
  };
};
