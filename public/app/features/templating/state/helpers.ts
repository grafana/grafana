import { combineReducers } from '@reduxjs/toolkit';
import cloneDeep from 'lodash/cloneDeep';

import { EMPTY_UUID } from './types';
import { VariableHide, VariableModel, VariableRefresh, VariableType } from '../variable';
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

export const variableMockBuilder = (type: VariableType) => {
  const initialState = variableAdapters.contains(type)
    ? cloneDeep(variableAdapters.get(type).initialState)
    : { name: type, type, label: '', hide: VariableHide.dontHide, skipUrlSync: false };
  const { uuid, index, global, ...rest } = initialState;
  const model = { ...rest, name: type };

  const withUuid = (uuid: string) => {
    model.uuid = uuid;
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

  const withCurrent = (text: string | string[]) => {
    model.current = { text, value: text, selected: true };
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

  const create = () => model;

  const instance = {
    withUuid,
    withName,
    withOptions,
    withCurrent,
    withRefresh,
    withQuery,
    withMulti,
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
