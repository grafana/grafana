import { Reducer } from 'redux';
import { PayloadAction } from '@reduxjs/toolkit';
import { UrlQueryValue } from '@grafana/runtime';

import { VariableModel, VariableOption, VariableType } from '../variable';
import { VariableState } from '../state/queryVariableReducer';
import { VariablePayload } from '../state/actions';
import { queryVariableAdapter } from './queryVariableAdapter';
import { variableStateReducerFactory } from '../state/variableStateReducerFactory';

export interface VariableAdapterBase<Model extends VariableModel, State extends VariableState> {
  dependsOn: (variable: Model, variableToTest: Model) => boolean;
  setValue: (variable: Model, option: VariableOption) => Promise<void>;
  setValueFromUrl: (variable: Model, urlValue: UrlQueryValue) => Promise<void>;
  updateOptions: (variable: Model, searchFilter?: string) => Promise<void>;
  useState: boolean;
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

const notMigratedVariableAdapter = (): VariableAdapter<any, any> => ({
  useState: false,
  reducer: state => state,
  dependsOn: (variable, variableToTest) => {
    return false;
  },
  setValue: (variable, urlValue) => Promise.resolve(),
  setValueFromUrl: (variable, urlValue) => Promise.resolve(),
  updateOptions: (variable, searchFilter) => Promise.resolve(),
});

export const variableAdapter: Record<VariableType, VariableAdapter<any, any>> = {
  query: queryVariableAdapter(),
  adhoc: notMigratedVariableAdapter(),
  constant: notMigratedVariableAdapter(),
  datasource: notMigratedVariableAdapter(),
  custom: notMigratedVariableAdapter(),
  interval: notMigratedVariableAdapter(),
  textbox: notMigratedVariableAdapter(),
};
