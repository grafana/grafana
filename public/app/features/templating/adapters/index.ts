import { ComponentType } from 'react';
import { Reducer } from 'redux';
import { UrlQueryValue } from '@grafana/runtime';

import { VariableModel, VariableOption, VariableType } from '../variable';
import { VariableEditorProps, VariablePickerProps, VariableState } from '../state/types';
import { TemplatingState } from '../state';

export interface VariableAdapter<Model extends VariableModel> {
  description: string;
  initialState: VariableState;
  dependsOn: (variableToTest: Model) => boolean;
  setValue: (option: VariableOption) => Promise<void>;
  setValueFromUrl: (urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (searchFilter?: string, notifyAngular?: boolean) => Promise<void>;
  getSaveModel: () => Partial<Model>;
  getValueForUrl: () => string | string[];
  picker: ComponentType<VariablePickerProps>;
  editor: ComponentType<VariableEditorProps>;
  reducer: Reducer<TemplatingState>;
}

const allVariableAdapters: Record<VariableType, boolean | null> = {
  query: true,
  textbox: null,
  constant: null,
  datasource: null,
  custom: null,
  interval: null,
  adhoc: null,
};

export interface VariableAdapters {
  contains: (type: VariableType) => boolean;
  // set: (type: VariableType, adapter: VariableAdapter<any>) => void;
}

export const variableAdapters: VariableAdapters = {
  contains: (type: VariableType): boolean => !!allVariableAdapters[type],
  // get: (type: VariableType): VariableAdapterFactory<VariableModel> => {
  //   if (allVariableAdapters[type] !== null) {
  //     // @ts-ignore
  //     // Suppressing strict null check in this case we know that this is an instance otherwise we throw
  //     // Type 'VariableAdapter<any, any> | null' is not assignable to type 'VariableAdapter<any, any>'.
  //     // Type 'null' is not assignable to type 'VariableAdapter<any, any>'.
  //     return allVariableAdapters[type];
  //   }

  //   throw new Error(`There is no adapter for type:${type}`);
  // },
  // set: (type: VariableType, adapter: VariableAdapter<any>): void => {
  //   allVariableAdapters[type] = adapter;
  // },
};

// variableAdapters.set('query', createQueryVariableAdapter());
