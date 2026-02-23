import { combineReducers } from '@reduxjs/toolkit';

import {
  TypedVariableModel,
  DashboardVariableModel,
  OrgVariableModel,
  UserVariableModel,
  VariableHide,
} from '@grafana/data';
import { VariableRefresh } from '@grafana/schema';
import { dashboardReducer } from 'app/features/dashboard/state/reducers';
import { DashboardState } from 'app/types/dashboard';
import { StoreState } from 'app/types/store';

import { VariableAdapter } from '../adapters';
import { NEW_VARIABLE_ID } from '../constants';
import { initialVariableModelState } from '../types';

import { createQueryVariable } from './__tests__/fixtures';
import { keyedVariablesReducer, KeyedVariablesState } from './keyedVariablesReducer';
import { getInitialTemplatingState, TemplatingState } from './reducers';
import { VariablesState } from './types';

export const getVariableState = (
  noOfVariables: number,
  inEditorIndex = -1,
  includeEmpty = false,
  includeSystem = false
): VariablesState => {
  const variables: Record<string, TypedVariableModel> = {};

  if (includeSystem) {
    const dashboardModel: DashboardVariableModel = {
      ...initialVariableModelState,
      id: '__dashboard',
      name: '__dashboard',
      type: 'system',
      index: -3,
      skipUrlSync: true,
      hide: VariableHide.hideVariable,
      current: {
        value: {
          name: 'A dashboard title',
          uid: 'An dashboard UID',
          toString: () => 'A dashboard title',
        },
      },
    };

    const orgModel: OrgVariableModel = {
      ...initialVariableModelState,
      id: '__org',
      name: '__org',
      type: 'system',
      index: -2,
      skipUrlSync: true,
      hide: VariableHide.hideVariable,
      current: {
        value: {
          name: 'An org name',
          id: 1,
          toString: () => '1',
        },
      },
    };

    const userModel: UserVariableModel = {
      ...initialVariableModelState,
      id: '__user',
      name: '__user',
      type: 'system',
      index: -1,
      skipUrlSync: true,
      hide: VariableHide.hideVariable,
      current: {
        value: {
          login: 'admin',
          id: 1,
          email: 'admin@test',
          toString: () => '1',
        },
      },
    };

    variables[dashboardModel.id] = dashboardModel;
    variables[orgModel.id] = orgModel;
    variables[userModel.id] = userModel;
  }

  for (let index = 0; index < noOfVariables; index++) {
    variables[index] = createQueryVariable({
      id: index.toString(),
      name: `Name-${index}`,
      label: `Label-${index}`,
      index,
    });
  }

  if (includeEmpty) {
    variables[NEW_VARIABLE_ID] = createQueryVariable({
      id: NEW_VARIABLE_ID,
      name: `Name-${NEW_VARIABLE_ID}`,
      label: `Label-${NEW_VARIABLE_ID}`,
      index: noOfVariables,
    });
  }

  return variables;
};

export const getVariableTestContext = <Model extends TypedVariableModel>(
  adapter: VariableAdapter<Model>,
  variableOverrides: Partial<Model> = {}
) => {
  const defaults: Partial<TypedVariableModel> = {
    id: '0',
    rootStateKey: 'key',
    index: 0,
    name: '0',
  };

  const defaultVariable = {
    ...adapter.initialState,
    ...defaults,
  };

  const initialState: VariablesState = {
    '0': { ...defaultVariable, ...variableOverrides },
  };

  return { initialState };
};

export const getRootReducer = () =>
  combineReducers({
    dashboard: dashboardReducer,
    templating: keyedVariablesReducer,
  });

export type RootReducerType = { dashboard: DashboardState; templating: KeyedVariablesState };

export const getTemplatingRootReducer = () =>
  combineReducers({
    templating: keyedVariablesReducer,
  });

export type TemplatingReducerType = { templating: KeyedVariablesState };

export function getPreloadedState(
  key: string,
  templatingState: Partial<TemplatingState>
): Pick<StoreState, 'templating'> {
  return {
    templating: {
      lastKey: key,
      keys: {
        [key]: {
          ...getInitialTemplatingState(),
          ...templatingState,
        },
      },
    },
  };
}

// function to find a query variable node in the list of all variables
export function findVariableNodeInList(allVariables: TypedVariableModel[], nodeName: string) {
  const variableNode = allVariables.find((v) => {
    return v.name === nodeName;
  });
  return variableNode;
}

/**
 * Checks if a variable is configured to refresh when the time range changes.
 *
 * The function supports three types of variables: 'query', 'datasource', and 'interval'.
 * Each of these variable types can be configured to refresh based on certain conditions.
 * For 'query' variables, we offer a UI configuration to set refresh "on time range change."
 * For 'interval' variables, the default configuration is often set to refresh "on time range change."
 * For 'datasource' variables, this property is assigned to their model.
 *
 * Note: for datasource, It's unclear if provisioned dashboards might come with this default setting for time range.
 *
 * @param variable - The variable object with its type and refresh setting
 * @returns True if the variable should refresh on time range change, otherwise False
 */
export function isVariableOnTimeRangeConfigured(variable: TypedVariableModel) {
  return (
    (variable.type === 'query' || variable.type === 'datasource' || variable.type === 'interval') &&
    variable.refresh === VariableRefresh.onTimeRangeChanged
  );
}
