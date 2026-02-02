import { cloneDeep } from 'lodash';

import { OptimizeVariableModel } from '@grafana/data';

import { dispatch } from '../../../store/store';
import { VariableAdapter } from '../adapters';
import { setOptionAsCurrent } from '../state/actions';
import { toKeyedVariableIdentifier } from '../utils';

import { OptimizeVariableEditor } from './OptimizeVariableEditor';
import { OptimizeVariablePicker } from './OptimizeVariablePicker';
import { setOptimizeVariableOptionsFromUrl, updateOptimizeVariableOptions } from './actions';
import { initialOptimizeVariableModelState, OptimizeVariableReducer } from './reducer';

export const createOptimizeVariableAdapter = (): VariableAdapter<OptimizeVariableModel> => {
  return {
    id: 'optimizepicker',
    description: 'Define an optimize variable, where users can select optimize query types',
    name: 'Optimize variable',
    initialState: initialOptimizeVariableModelState,
    reducer: OptimizeVariableReducer,
    picker: OptimizeVariablePicker,
    editor: OptimizeVariableEditor,
    dependsOn: (variable, variableToTest) => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      await dispatch(setOptionAsCurrent(toKeyedVariableIdentifier(variable), option, emitChanges));
    },
    setValueFromUrl: async (variable, urlValue) => {
      await dispatch(setOptimizeVariableOptionsFromUrl(toKeyedVariableIdentifier(variable), urlValue));
    },
    updateOptions: async (variable) => {
      await dispatch(updateOptimizeVariableOptions(toKeyedVariableIdentifier(variable)));
    },
    getSaveModel: (variable, saveCurrentAsDefault) => {
      const { index, id, state, global, originalQuery, ...rest } = cloneDeep(variable);
      return rest;
    },
    getValueForUrl: (variable) => {
      return variable.current.value;
    },
    beforeAdding: (model) => {
      return { ...cloneDeep(model), originalQuery: model.query };
    },
  };
};
