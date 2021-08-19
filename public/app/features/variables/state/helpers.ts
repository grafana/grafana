import { combineReducers } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';

import { NEW_VARIABLE_ID, VariablesState } from './types';
import { VariableHide, VariableModel } from '../types';

import { VariableAdapter } from '../adapters';
import { dashboardReducer } from 'app/features/dashboard/state/reducers';
import { templatingReducers, TemplatingState } from './reducers';
import { DashboardState } from '../../../types';

export const getVariableState = (
  noOfVariables: number,
  inEditorIndex = -1,
  includeEmpty = false
): Record<string, VariableModel> => {
  const variables: Record<string, VariableModel> = {};

  for (let index = 0; index < noOfVariables; index++) {
    variables[index] = {
      id: index.toString(),
      type: 'query',
      name: `Name-${index}`,
      hide: VariableHide.dontHide,
      index,
      label: `Label-${index}`,
      skipUrlSync: false,
      global: false,
      state: LoadingState.NotStarted,
      error: null,
      description: null,
    };
  }

  if (includeEmpty) {
    variables[NEW_VARIABLE_ID] = {
      id: NEW_VARIABLE_ID,
      type: 'query',
      name: `Name-${NEW_VARIABLE_ID}`,
      hide: VariableHide.dontHide,
      index: noOfVariables,
      label: `Label-${NEW_VARIABLE_ID}`,
      skipUrlSync: false,
      global: false,
      state: LoadingState.NotStarted,
      error: null,
      description: null,
    };
  }

  return variables;
};

export const getVariableTestContext = <Model extends VariableModel>(
  adapter: VariableAdapter<Model>,
  variableOverrides: Partial<Model> = {}
) => {
  const defaultVariable = {
    ...adapter.initialState,
    id: '0',
    index: 0,
    name: '0',
  };

  const initialState: VariablesState = {
    '0': { ...defaultVariable, ...variableOverrides },
  };

  return { initialState };
};

export const getRootReducer = () =>
  combineReducers({
    dashboard: dashboardReducer,
    templating: templatingReducers,
  });

export type RootReducerType = { dashboard: DashboardState; templating: TemplatingState };

export const getTemplatingRootReducer = () =>
  combineReducers({
    templating: templatingReducers,
  });

export type TemplatingReducerType = { templating: TemplatingState };
