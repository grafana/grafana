import { ComponentType } from 'react';
import { SystemVariable, VariableHide } from '../types';
import { VariableAdapter } from '../adapters';
import { NEW_VARIABLE_ID } from '../state/types';
import { Deferred } from '../../../core/utils/deferred';
import { VariablePickerProps } from '../pickers/types';
import { VariableEditorProps } from '../editor/types';

export const createSystemVariableAdapter = (): VariableAdapter<SystemVariable<any>> => {
  return {
    id: 'system',
    description: '',
    name: 'system',
    initialState: {
      id: NEW_VARIABLE_ID,
      global: false,
      type: 'system',
      name: '',
      label: (null as unknown) as string,
      hide: VariableHide.hideVariable,
      skipUrlSync: true,
      current: { value: { toString: () => '' } },
      index: -1,
      initLock: (null as unknown) as Deferred,
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
