import cloneDeep from 'lodash/cloneDeep';
import { ConstantVariableModel } from '../types';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { constantVariableReducer, initialConstantVariableModelState } from './reducer';
import { OptionsPicker } from '../pickers';
import { ConstantVariableEditor } from './ConstantVariableEditor';
import { updateConstantVariableOptions } from './actions';
import { toVariableIdentifier } from '../state/types';

export const createConstantVariableAdapter = (): VariableAdapter<ConstantVariableModel> => {
  return {
    id: 'constant',
    description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share',
    name: 'Constant',
    initialState: initialConstantVariableModelState,
    reducer: constantVariableReducer,
    picker: OptionsPicker,
    editor: ConstantVariableEditor,
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
      await dispatch(updateConstantVariableOptions(toVariableIdentifier(variable)));
    },
    getSaveModel: variable => {
      const { index, id, initLock, global, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: variable => {
      return variable.current.value;
    },
  };
};
