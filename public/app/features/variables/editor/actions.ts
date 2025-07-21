import { cloneDeep } from 'lodash';

import { TypedVariableModel, VariableType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ThunkResult } from 'app/types/store';

import { variableAdapters } from '../adapters';
import { initInspect } from '../inspect/reducer';
import { createUsagesNetwork, transformUsagesToNetwork } from '../inspect/utils';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getEditorVariables, getNewVariableIndex, getVariable, getVariablesByKey } from '../state/selectors';
import { addVariable, removeVariable } from '../state/sharedReducer';
import { AddVariable, KeyedVariableIdentifier, VariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier, toStateKey, toVariablePayload } from '../utils';

import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  variableEditorMounted,
  variableEditorUnMounted,
} from './reducer';

export const variableEditorMount = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { rootStateKey } = identifier;
    dispatch(
      toKeyedAction(rootStateKey, variableEditorMounted({ name: getVariable(identifier).name, id: identifier.id }))
    );
  };
};

export const variableEditorUnMount = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { rootStateKey } = identifier;
    dispatch(toKeyedAction(rootStateKey, variableEditorUnMounted(toVariablePayload(identifier))));
  };
};

export const changeVariableName = (identifier: KeyedVariableIdentifier, newName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { id, rootStateKey: uid } = identifier;
    let errorText = null;
    if (!newName.match(/^(?!__).*$/)) {
      errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
    }

    if (!newName.match(/^\w+$/)) {
      errorText = 'Only word characters are allowed in variable names';
    }

    const variables = getVariablesByKey(uid, getState());
    const foundVariables = variables.filter((v) => v.name === newName && v.id !== id);

    if (foundVariables.length) {
      errorText = 'Variable with the same name already exists';
    }

    if (errorText) {
      dispatch(toKeyedAction(uid, changeVariableNameFailed({ newName, errorText })));
      return;
    }

    dispatch(completeChangeVariableName(identifier, newName));
  };
};

export const completeChangeVariableName =
  (identifier: KeyedVariableIdentifier, newName: string): ThunkResult<void> =>
  (dispatch, getState) => {
    const { rootStateKey } = identifier;
    const originalVariable = getVariable(identifier, getState());
    if (originalVariable.name === newName) {
      dispatch(toKeyedAction(rootStateKey, changeVariableNameSucceeded(toVariablePayload(identifier, { newName }))));
      return;
    }
    const model = { ...cloneDeep(originalVariable), name: newName, id: newName };
    const global = originalVariable.global;
    const index = originalVariable.index;
    const renamedIdentifier = toKeyedVariableIdentifier(model);

    dispatch(toKeyedAction(rootStateKey, addVariable(toVariablePayload(renamedIdentifier, { global, index, model }))));
    dispatch(
      toKeyedAction(rootStateKey, changeVariableNameSucceeded(toVariablePayload(renamedIdentifier, { newName })))
    );
    dispatch(toKeyedAction(rootStateKey, removeVariable(toVariablePayload(identifier, { reIndex: false }))));
  };

export const createNewVariable =
  (key: string | null | undefined, type: VariableType = 'query'): ThunkResult<void> =>
  (dispatch, getState) => {
    const rootStateKey = toStateKey(key);
    const varsByKey = getVariablesByKey(rootStateKey, getState());
    const id = getNextAvailableId(type, varsByKey);
    const identifier: VariableIdentifier = { type, id };
    const global = false;
    const index = getNewVariableIndex(rootStateKey, getState());
    const model: TypedVariableModel = cloneDeep(variableAdapters.get(type).initialState);
    model.id = id;
    model.name = id;
    model.rootStateKey = rootStateKey;
    dispatch(
      toKeyedAction(rootStateKey, addVariable(toVariablePayload<AddVariable>(identifier, { global, model, index })))
    );

    locationService.partial({ editIndex: varsByKey.length });
  };

export const initListMode =
  (key: string | null | undefined): ThunkResult<void> =>
  (dispatch, getState) => {
    const rootStateKey = toStateKey(key);
    const state = getState();
    const variables = getEditorVariables(rootStateKey, state);
    const dashboard = state.dashboard.getModel();
    const { usages } = createUsagesNetwork(variables, dashboard);
    const usagesNetwork = transformUsagesToNetwork(usages);

    dispatch(toKeyedAction(rootStateKey, initInspect({ usages, usagesNetwork })));
  };

export function getNextAvailableId(type: VariableType, variables: TypedVariableModel[]): string {
  let counter = 0;
  let nextId = `${type}${counter}`;

  while (variables.find((variable) => variable.id === nextId)) {
    nextId = `${type}${++counter}`;
  }

  return nextId;
}
