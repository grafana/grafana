import { combineReducers } from '@reduxjs/toolkit';
import { LoadingState } from '@grafana/data';

import { NEW_VARIABLE_ID } from './types';
import { VariableHide, VariableModel } from '../types';
import { VariablesState } from './variablesReducer';
import { locationReducer } from '../../../core/reducers/location';
import { VariableAdapter } from '../adapters';
import { dashboardReducer } from 'app/features/dashboard/state/reducers';
import { templatingReducers } from './reducers';

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
    location: locationReducer,
    dashboard: dashboardReducer,
    templating: templatingReducers,
  });

export const getTemplatingRootReducer = () =>
  combineReducers({
    templating: templatingReducers,
  });

export const getTemplatingAndLocationRootReducer = () =>
  combineReducers({
    templating: templatingReducers,
    location: locationReducer,
  });
