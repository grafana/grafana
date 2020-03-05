import { ComponentType } from 'react';
import { Reducer } from 'redux';
import { UrlQueryValue } from '@grafana/runtime';

import { VariableModel, VariableOption, VariableType } from './variable';
import { VariableEditorProps } from './editor/types';
import { VariablesState } from './state/variablesReducer';
import { VariablePickerProps } from './pickers/types';

export interface VariableAdapter<Model extends VariableModel> {
  description: string;
  label: string;
  initialState: Model;
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption, emitChanges?: boolean) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string) => Promise<void>;
  getSaveModel: (variable: Model) => Partial<Model>;
  getValueForUrl: (variable: Model) => string | string[];
  picker: ComponentType<VariablePickerProps>;
  editor: ComponentType<VariableEditorProps>;
  reducer: Reducer<VariablesState>;
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
  set: (type, adapter) => (allVariableAdapters[type] = adapter),
  registeredTypes: (): Array<{ type: VariableType; label: string }> => {
    return Object.keys(allVariableAdapters)
      .filter((key: VariableType) => allVariableAdapters[key] !== null)
      .map((key: VariableType) => ({ type: key, label: allVariableAdapters[key]!.label }));
  },
};
