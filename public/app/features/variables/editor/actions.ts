import { ThunkResult } from '../../../types';
import { getEditorVariables, getNewVariabelIndex, getVariable, getVariables } from '../state/selectors';
import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  clearIdInEditor,
  setIdInEditor,
  variableEditorMounted,
  variableEditorUnMounted,
} from './reducer';
import { variableAdapters } from '../adapters';
import { AddVariable, toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import cloneDeep from 'lodash/cloneDeep';
import { VariableType } from '@grafana/data';
import { addVariable, removeVariable } from '../state/sharedReducer';
import { updateOptions } from '../state/actions';
import { VariableModel } from '../types';
import { initInspect } from '../inspect/reducer';
import { createUsagesNetwork, transformUsagesToNetwork } from '../inspect/utils';

export const variableEditorMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    dispatch(variableEditorMounted({ name: getVariable(identifier.id).name }));
  };
};

export const variableEditorUnMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    dispatch(variableEditorUnMounted(toVariablePayload(identifier)));
  };
};

export const onEditorUpdate = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    await dispatch(updateOptions(identifier));
    dispatch(switchToListMode());
  };
};

export const changeVariableName = (identifier: VariableIdentifier, newName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    let errorText = null;
    if (!newName.match(/^(?!__).*$/)) {
      errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
    }

    if (!newName.match(/^\w+$/)) {
      errorText = 'Only word and digit characters are allowed in variable names';
    }

    const variables = getVariables(getState());
    const foundVariables = variables.filter((v) => v.name === newName && v.id !== identifier.id);

    if (foundVariables.length) {
      errorText = 'Variable with the same name already exists';
    }

    if (errorText) {
      dispatch(changeVariableNameFailed({ newName, errorText }));
      return;
    }

    dispatch(completeChangeVariableName(identifier, newName));
  };
};

export const completeChangeVariableName = (identifier: VariableIdentifier, newName: string): ThunkResult<void> => (
  dispatch,
  getState
) => {
  const originalVariable = getVariable(identifier.id, getState());
  if (originalVariable.name === newName) {
    dispatch(changeVariableNameSucceeded(toVariablePayload(identifier, { newName })));
    return;
  }
  const model = { ...cloneDeep(originalVariable), name: newName, id: newName };
  const global = originalVariable.global;
  const index = originalVariable.index;
  const renamedIdentifier = toVariableIdentifier(model);

  dispatch(addVariable(toVariablePayload(renamedIdentifier, { global, index, model })));
  dispatch(changeVariableNameSucceeded(toVariablePayload(renamedIdentifier, { newName })));
  dispatch(switchToEditMode(renamedIdentifier));
  dispatch(removeVariable(toVariablePayload(identifier, { reIndex: false })));
};

export const switchToNewMode = (type: VariableType = 'query'): ThunkResult<void> => (dispatch, getState) => {
  const id = getNextAvailableId(type, getVariables(getState()));
  const identifier = { type, id };
  const global = false;
  const index = getNewVariabelIndex(getState());
  const model = cloneDeep(variableAdapters.get(type).initialState);
  model.id = id;
  model.name = id;
  dispatch(
    addVariable(
      toVariablePayload<AddVariable>(identifier, { global, model, index })
    )
  );
  dispatch(setIdInEditor({ id: identifier.id }));
};

export const switchToEditMode = (identifier: VariableIdentifier): ThunkResult<void> => (dispatch) => {
  dispatch(setIdInEditor({ id: identifier.id }));
};

export const switchToListMode = (): ThunkResult<void> => (dispatch, getState) => {
  dispatch(clearIdInEditor());
  const state = getState();
  const variables = getEditorVariables(state);
  const dashboard = state.dashboard.getModel();
  const { unknown, usages } = createUsagesNetwork(variables, dashboard);
  const unknownsNetwork = transformUsagesToNetwork(unknown);
  const unknownExits = Object.keys(unknown).length > 0;
  const usagesNetwork = transformUsagesToNetwork(usages);

  dispatch(initInspect({ unknown, usages, usagesNetwork, unknownsNetwork, unknownExits }));
};

export function getNextAvailableId(type: VariableType, variables: VariableModel[]): string {
  let counter = 0;
  let nextId = `${type}${counter}`;

  while (variables.find((variable) => variable.id === nextId)) {
    nextId = `${type}${++counter}`;
  }

  return nextId;
}
