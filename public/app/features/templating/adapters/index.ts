import { ComponentType } from 'react';
import { Reducer } from 'redux';
import { PayloadAction } from '@reduxjs/toolkit';
import { UrlQueryValue } from '@grafana/runtime';

import { VariableModel, VariableOption, VariableType } from '../variable';
import { VariablePayload } from '../state/actions';
import { createQueryVariableAdapter } from './queryVariableAdapter';
import { VariableEditorProps, VariableState } from '../state/types';

export interface VariableAdapter<Model extends VariableModel, State extends VariableState> {
  description: string;
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string, notifyAngular?: boolean) => Promise<void>;
  picker: ComponentType<VariableState>;
  editor: ComponentType<VariableEditorProps>;
  reducer: Reducer<State, PayloadAction<VariablePayload<any>>>;
}

const allVariableAdapters: Record<VariableType, VariableAdapter<any, any> | null> = {
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
  get: (type: VariableType) => VariableAdapter<any, any>;
  set: (type: VariableType, adapter: VariableAdapter<any, any>) => void;
}

export const variableAdapters: VariableAdapters = {
  contains: (type: VariableType): boolean => !!allVariableAdapters[type],
  get: (type: VariableType): VariableAdapter<any, any> => {
    if (allVariableAdapters[type] !== null) {
      // @ts-ignore
      // Suppressing strict null check in this case we know that this is an instance otherwise we throw
      // Type 'VariableAdapter<any, any> | null' is not assignable to type 'VariableAdapter<any, any>'.
      // Type 'null' is not assignable to type 'VariableAdapter<any, any>'.
      return allVariableAdapters[type];
    }

    throw new Error(`There is no adapter for type:${type}`);
  },
  set: (type: VariableType, adapter: VariableAdapter<any, any>): void => {
    allVariableAdapters[type] = adapter;
  },
};

variableAdapters.set('query', createQueryVariableAdapter());
