import { combineReducers } from '@reduxjs/toolkit';
import cloneDeep from 'lodash/cloneDeep';

import { NEW_VARIABLE_ID } from './types';
import { VariableHide, VariableModel, VariableRefresh, VariableType } from '../../templating/variable';
import { variablesReducer, VariablesState } from './variablesReducer';
import { optionsPickerReducer } from '../pickers/OptionsPicker/reducer';
import { variableEditorReducer } from '../editor/reducer';
import { locationReducer } from '../../../core/reducers/location';
import { VariableAdapter, variableAdapters } from '../adapters';

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

export const variableMockBuilder = (type: VariableType) => {
  const initialState = variableAdapters.contains(type)
    ? cloneDeep(variableAdapters.get(type).initialState)
    : { name: type, type, label: '', hide: VariableHide.dontHide, skipUrlSync: false };
  const { id, index, global, ...rest } = initialState;
  const model = { ...rest, name: type };

  const withId = (id: string) => {
    model.id = id;
    return instance;
  };

  const withName = (name: string) => {
    model.name = name;
    return instance;
  };

  const withOptions = (...texts: string[]) => {
    model.options = [];
    for (let index = 0; index < texts.length; index++) {
      model.options.push({ text: texts[index], value: texts[index], selected: false });
    }
    return instance;
  };

  const withCurrent = (text: string | string[], value?: string | string[]) => {
    model.current = { text, value: value ?? text, selected: true };
    return instance;
  };

  const withRefresh = (refresh: VariableRefresh) => {
    model.refresh = refresh;
    return instance;
  };

  const withQuery = (query: string) => {
    model.query = query;
    return instance;
  };

  const withMulti = () => {
    model.multi = true;
    return instance;
  };

  const withRegEx = (regex: any) => {
    model.regex = regex;
    return instance;
  };

  const withAuto = (auto: boolean) => {
    model.auto = auto;
    return instance;
  };

  const withAutoCount = (autoCount: number) => {
    model.auto_count = autoCount;
    return instance;
  };

  const withAutoMin = (autoMin: string) => {
    model.auto_min = autoMin;
    return instance;
  };

  const create = () => model;

  const instance = {
    withId,
    withName,
    withOptions,
    withCurrent,
    withRefresh,
    withQuery,
    withMulti,
    withRegEx,
    withAuto,
    withAutoCount,
    withAutoMin,
    create,
  };

  return instance;
};

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
