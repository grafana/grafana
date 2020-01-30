import { ComponentType } from 'react';
import { Reducer } from 'redux';
import { PayloadAction } from '@reduxjs/toolkit';
import { UrlQueryValue } from '@grafana/runtime';

import { VariableModel, VariableOption, VariableType } from '../variable';
import { VariablePayload } from '../state/actions';
import { createQueryVariableAdapter } from './queryVariableAdapter';
import { VariableState } from '../state/types';

export interface VariableAdapter<Model extends VariableModel, State extends VariableState> {
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string) => Promise<void>;
  onEditorUpdate: (variable: Model) => Promise<void>;
  picker: ComponentType<VariableState>;
  editor: ComponentType<VariableState>;
  reducer: Reducer<State, PayloadAction<VariablePayload<any>>>;
}

const allVariableAdapters: Record<VariableType, VariableAdapter<any, any>> = {
  query: null,
  textbox: null,
  constant: null,
  datasource: null,
  custom: null,
  interval: null,
  adhoc: null,
};

export const variableAdapters = {
  contains: (type: VariableType) => !!allVariableAdapters[type],
  get: (type: VariableType) => {
    if (!variableAdapters.contains(type)) {
      throw new Error(`There is no adapter for type:${type}`);
    }
    return allVariableAdapters[type];
  },
  set: (type: VariableType, adapter: VariableAdapter<any, any>) => {
    allVariableAdapters[type] = adapter;
  },
};

variableAdapters.set('query', createQueryVariableAdapter());
