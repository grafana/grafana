import { ComponentType } from 'react';
import { LoadingState } from '@grafana/data';

import { initialVariableModelState, SystemVariable, VariableHide } from '../types';
import { VariableAdapter } from '../adapters';
import { VariablePickerProps } from '../pickers/types';
import { VariableEditorProps } from '../editor/types';

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
    reducer: (state: any, action: any) => state,
    picker: (null as unknown) as ComponentType<VariablePickerProps>,
    editor: (null as unknown) as ComponentType<VariableEditorProps>,
    dependsOn: () => {
      return false;
    },
    setValue: async (variable, option, emitChanges = false) => {
      return;
    },
    setValueFromUrl: async (variable, urlValue) => {
      return;
    },
    updateOptions: async variable => {
      return;
    },
    getSaveModel: variable => {
      return {};
    },
    getValueForUrl: variable => {
      return '';
    },
  };
};
