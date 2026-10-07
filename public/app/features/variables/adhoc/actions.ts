import { cloneDeep } from 'lodash';

import { type AdHocVariableFilter, type AdHocVariableModel, type DataSourceRef } from '@grafana/data';
import { type StoreState, type ThunkResult } from 'app/types/store';

import { isAdHoc } from '../guard';
import { variableUpdated } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getLastKey, getNewVariableIndex, getVariable, getVariablesState } from '../state/selectors';
import { addVariable } from '../state/sharedReducer';
import { type AddVariable, type KeyedVariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import {
  type AdHocVariabelFilterUpdate,
  filterAdded,
  filterRemoved,
  filtersRestored,
  filterUpdated,
  initialAdHocVariableModelState,
} from './reducer';

export interface AdHocTableOptions {
  datasource: DataSourceRef;
  key: string;
  value: string;
  operator: string;
}

const filterTableName = 'Filters';

export const applyFilterFromTable = (options: AdHocTableOptions): ThunkResult<void> => {
  return async (dispatch, getState) => {
    let variable = getVariableByOptions(options, getState());

    if (!variable) {
      dispatch(createAdHocVariable(options));
      variable = getVariableByOptions(options, getState());
      if (!variable) {
        return;
      }
    }

    const index = variable.filters.findIndex((f) => f.key === options.key && f.value === options.value);

    if (index === -1) {
      const { value, key, operator } = options;
      const filter = { value, key, operator };
      return await dispatch(addFilter(toKeyedVariableIdentifier(variable), filter));
    }

    const filter = { ...variable.filters[index], operator: options.operator };
    return await dispatch(changeFilter(toKeyedVariableIdentifier(variable), { index, filter }));
  };
};

export const changeFilter = (
  identifier: KeyedVariableIdentifier,
  update: AdHocVariabelFilterUpdate
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filterUpdated(toVariablePayload(variable, update))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const removeFilter = (identifier: KeyedVariableIdentifier, index: number): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filterRemoved(toVariablePayload(variable, index))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const addFilter = (identifier: KeyedVariableIdentifier, filter: AdHocVariableFilter): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filterAdded(toVariablePayload(variable, filter))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const setFiltersFromUrl = (
  identifier: KeyedVariableIdentifier,
  filters: AdHocVariableFilter[]
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filtersRestored(toVariablePayload(variable, filters))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

const createAdHocVariable = (options: AdHocTableOptions): ThunkResult<void> => {
  return (dispatch, getState) => {
    const key = getLastKey(getState());

    const model: AdHocVariableModel = {
      ...cloneDeep(initialAdHocVariableModelState),
      datasource: options.datasource,
      name: filterTableName,
      id: filterTableName,
      rootStateKey: key,
    };

    const global = false;
    const index = getNewVariableIndex(key, getState());
    const identifier: KeyedVariableIdentifier = { type: 'adhoc', id: model.id, rootStateKey: key };

    dispatch(toKeyedAction(key, addVariable(toVariablePayload<AddVariable>(identifier, { global, model, index }))));
  };
};

const getVariableByOptions = (options: AdHocTableOptions, state: StoreState): AdHocVariableModel | undefined => {
  const key = getLastKey(state);
  const templatingState = getVariablesState(key, state);
  let result: AdHocVariableModel | undefined;
  for (const v of Object.values(templatingState.variables)) {
    if (isAdHoc(v) && v.datasource?.uid === options.datasource.uid) {
      result = v;
      break;
    }
  }
  return result;
};
