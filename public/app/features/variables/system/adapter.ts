import { LoadingState, type SystemVariable, VariableHide } from '@grafana/data';

import { type VariableAdapter } from '../adapters';
import { initialVariableModelState } from '../types';

export const createSystemVariableAdapter = (): VariableAdapter<SystemVariable<any>> => {
  return {
    id: 'system',
    description: '',
    name: 'system',
    initialState: {
      ...initialVariableModelState,
      type: 'system',
      hide: VariableHide.hideVariable,
      skipUrlSync: true,
      current: { value: { toString: () => '' } },
      state: LoadingState.Done,
    },
    reducer: (state: any) => state,
    dependsOn: () => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      return;
    },
    setValueFromUrl: async (variable, urlValue) => {
      return;
    },
    updateOptions: async (variable) => {
      return;
    },
    getSaveModel: (variable) => {
      return {};
    },
    getValueForUrl: (variable) => {
      return '';
    },
  };
};
