import { ComponentType } from 'react';
import { Reducer } from 'redux';
import { PayloadAction } from '@reduxjs/toolkit';
import { UrlQueryValue } from '@grafana/runtime';

import { VariableModel, VariableOption, VariableType } from '../variable';
import { VariableState } from '../state/queryVariableReducer';
import { VariablePayload } from '../state/actions';
import { variableStateReducerFactory } from '../state/variableStateReducerFactory';
import { VariableProps } from '../picker/VariablePicker';
import { createQueryVariableAdapter } from './queryVariableAdapter';

export interface VariableAdapterBase<Model extends VariableModel, State extends VariableState> {
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string) => Promise<void>;
  picker: ComponentType<VariableProps>;
  editor: ComponentType<VariableProps>;
}

export interface CreateVariableAdapterProps<Model extends VariableModel, State extends VariableState>
  extends VariableAdapterBase<Model, State> {
  instanceReducer: Reducer<State, PayloadAction<VariablePayload<any>>>;
}

export interface VariableAdapter<Model extends VariableModel, State extends VariableState>
  extends VariableAdapterBase<Model, State> {
  reducer: Reducer<State[], PayloadAction<VariablePayload<any>>>;
}

export const createVariableAdapter = <
  Model extends VariableModel = VariableModel,
  State extends VariableState = VariableState
>(
  type: VariableType,
  props: CreateVariableAdapterProps<Model, State>
) => {
  const { instanceReducer, ...rest } = props;
  const reducer = variableStateReducerFactory(type, instanceReducer);
  return {
    ...rest,
    reducer,
  };
};

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
