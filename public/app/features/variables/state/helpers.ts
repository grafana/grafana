import { combineReducers } from '@reduxjs/toolkit';

import { EMPTY_UUID } from './types';
import { VariableHide, VariableModel } from '../../templating/variable';
import { variablesReducer, VariablesState } from './variablesReducer';
import { optionsPickerReducer } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer } from '../editor/reducer';
import { locationReducer } from '../../../core/reducers/location';
import { VariableAdapter } from '../adapters';
import { dashboardReducer } from 'app/features/dashboard/state/reducers';

export const getVariableState = (
  noOfVariables: number,
  inEditorIndex = -1,
  includeEmpty = false
): Record<string, VariableModel> => {
  const variables: Record<string, VariableModel> = {};

  for (let index = 0; index < noOfVariables; index++) {
    variables[index] = {
      uuid: index.toString(),
      type: 'query',
      name: `Name-${index}`,
      hide: VariableHide.dontHide,
      index,
      label: `Label-${index}`,
      skipUrlSync: false,
    };
  }

  if (includeEmpty) {
    variables[EMPTY_UUID] = {
      uuid: EMPTY_UUID,
      type: 'query',
      name: `Name-${EMPTY_UUID}`,
      hide: VariableHide.dontHide,
      index: noOfVariables,
      label: `Label-${EMPTY_UUID}`,
      skipUrlSync: false,
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
    uuid: '0',
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
    templating: combineReducers({
      optionsPicker: optionsPickerReducer,
      editor: variableEditorReducer,
      variables: variablesReducer,
    }),
  });

export const getTemplatingRootReducer = () =>
  combineReducers({
    templating: combineReducers({
      optionsPicker: optionsPickerReducer,
      editor: variableEditorReducer,
      variables: variablesReducer,
    }),
  });

export const getTemplatingAndLocationRootReducer = () =>
  combineReducers({
    templating: combineReducers({
      optionsPicker: optionsPickerReducer,
      editor: variableEditorReducer,
      variables: variablesReducer,
    }),
    location: locationReducer,
  });
