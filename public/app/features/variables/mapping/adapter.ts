import cloneDeep from 'lodash/cloneDeep';
import { MappingVariableModel } from '../types';
import { dispatch } from '../../../store/store';
import { setOptionAsCurrent, setOptionFromUrl } from '../state/actions';
import { VariableAdapter } from '../adapters';
import { mappingVariableReducer, initialMappingVariableModelState } from './reducer';
import { OptionsPicker } from '../pickers';
import { MappingVariableEditor } from './MappingVariableEditor';
import { updateMappingVariableOptions } from './actions';
import { ALL_VARIABLE_TEXT, toVariableIdentifier } from '../state/types';
import { isAllVariable } from '../utils';

export const createMappingVariableAdapter = (): VariableAdapter<MappingVariableModel> => {
  return {
    id: 'mapping',
    description: 'Define a custom mapping of values manually',
    name: 'Mapping',
    initialState: initialMappingVariableModelState,
    reducer: mappingVariableReducer,
    picker: OptionsPicker,
    editor: MappingVariableEditor,
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
      await dispatch(updateMappingVariableOptions(toVariableIdentifier(variable)));
    },
    getSaveModel: variable => {
      const { index, id, initLock, global, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: variable => {
      if (isAllVariable(variable)) {
        return ALL_VARIABLE_TEXT;
      }
      return variable.current.value;
    },
  };
};
