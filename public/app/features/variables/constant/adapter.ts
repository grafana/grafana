import { cloneDeep } from 'lodash';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { optionPickerFactory } from '../pickers';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { ConstantVariableModel } from '../types';
import { toKeyedVariableIdentifier } from '../utils';

import { ConstantVariableEditor } from './ConstantVariableEditor';
import { updateConstantVariableOptions } from './actions';
import { constantVariableReducer, initialConstantVariableModelState } from './reducer';

export const createConstantVariableAdapter = (): VariableAdapter<ConstantVariableModel> => {
  return {
    id: 'constant',
    description: 'Define a hidden constant variable, useful for metric prefixes in dashboards you want to share.',
    name: 'Constant',
    initialState: initialConstantVariableModelState,
    reducer: constantVariableReducer,
    picker: optionPickerFactory<ConstantVariableModel>(),
    editor: ConstantVariableEditor,
    dependsOn: () => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateConstantVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable) => {
      const { index, id, state, global, current, options, rootStateKey, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: (variable) => {
      return variable.current.value;
    },
    beforeAdding: (model) => {
      const { current, options, query, ...rest } = cloneDeep(model);
      const option = { selected: true, text: query, value: query };

      return { ...rest, current: option, options: [option], query };
    },
  };
};
