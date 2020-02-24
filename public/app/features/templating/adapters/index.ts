import { ComponentType } from 'react';
import { Reducer } from 'redux';
import { UrlQueryValue } from '@grafana/runtime';

import { VariableModel, VariableOption, VariableType } from '../variable';
import { createQueryVariableAdapter } from '../query/adapter';
import { VariableEditorProps, VariablePickerProps, VariableState } from '../state/types';
import { TemplatingState } from '../state';

export interface VariableAdapter<Model extends VariableModel> {
  description: string;
  label: string;
  initialState: VariableState;
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string, notifyAngular?: boolean) => Promise<void>;
  getSaveModel: (variable: Model) => Partial<Model>;
  getValueForUrl: (variable: Model) => string | string[];
  picker: ComponentType<VariablePickerProps>;
  editor: ComponentType<VariableEditorProps>;
  reducer: Reducer<TemplatingState>;
}

const allVariableAdapters: Record<VariableType, VariableAdapter<any> | null> = {
  query: null,
  textbox: null,
  constant: null,
  datasource: null,
  custom: null,
  interval: null,
  adhoc: null,
};

export interface VariableAdapters {
  contains: (type: VariableType) => boolean;
  get: (type: VariableType) => VariableAdapter<any>;
  set: (type: VariableType, adapter: VariableAdapter<any>) => void;
  registeredTypes: () => Array<{ type: VariableType; label: string }>;
}

export const variableAdapters: VariableAdapters = {
  contains: (type: VariableType): boolean => !!allVariableAdapters[type],
  get: (type: VariableType): VariableAdapter<any> => {
    if (allVariableAdapters[type] !== null) {
      // @ts-ignore
      // Suppressing strict null check in this case we know that this is an instance otherwise we throw
      // Type 'VariableAdapter<any, any> | null' is not assignable to type 'VariableAdapter<any, any>'.
      // Type 'null' is not assignable to type 'VariableAdapter<any, any>'.
      return allVariableAdapters[type];
    }

    throw new Error(`There is no adapter for type:${type}`);
  },
  set: (type: VariableType, adapter: VariableAdapter<any>): void => {
    allVariableAdapters[type] = adapter;
  },
  registeredTypes: (): Array<{ type: VariableType; label: string }> => {
    return Object.keys(allVariableAdapters)
      .filter((key: VariableType) => allVariableAdapters[key] !== null)
      .map((key: VariableType) => ({ type: key, label: allVariableAdapters[key].label }));
  },
};

variableAdapters.set('query', createQueryVariableAdapter());
