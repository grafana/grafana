import cloneDeep from 'lodash/cloneDeep';
import { CustomVariableModel } from '../../templating/types';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { customVariableReducer, initialCustomVariableModelState } from './reducer';
import { OptionsPicker } from '../pickers';
import { CustomVariableEditor } from './CustomVariableEditor';
import { updateCustomVariableOptions } from './actions';
import { ALL_VARIABLE_TEXT, toVariableIdentifier } from '../state/types';

export const createCustomVariableAdapter = (): VariableAdapter<CustomVariableModel> => {
  return {
    id: 'custom',
    description: 'Define variable values manually',
    name: 'Custom',
    initialState: initialCustomVariableModelState,
    reducer: customVariableReducer,
    picker: OptionsPicker,
    editor: CustomVariableEditor,
    dependsOn: () => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toVariableIdentifier(variable), urlValue));
    },
    updateOptions: async variable => {
      await dispatch(updateCustomVariableOptions(toVariableIdentifier(variable)));
    },
    getSaveModel: variable => {
      const { index, id, initLock, global, ...rest } = cloneDeep(variable);
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
