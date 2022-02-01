import { ThunkResult } from '../../../types';
import {
  getDashboardEditorVariables,
  getDashboardVariable,
  getDashboardVariables,
  getNewDashboardVariableIndex,
} from '../state/selectors';
import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  clearIdInEditor,
  setIdInEditor,
  variableEditorMounted,
  variableEditorUnMounted,
} from './reducer';
import { variableAdapters } from '../adapters';
import { AddVariable, DashboardVariableIdentifier } from '../state/types';
import { cloneDeep } from 'lodash';
import { VariableType } from '@grafana/data';
import { addVariable, removeVariable } from '../state/sharedReducer';
import { updateOptions } from '../state/actions';
import { VariableModel } from '../types';
import { initInspect } from '../inspect/reducer';
import { createUsagesNetwork, transformUsagesToNetwork } from '../inspect/utils';
import { toKeyedAction } from '../state/dashboardVariablesReducer';
import { toDashboardVariableIdentifier, toVariablePayload } from '../utils';

export const variableEditorMount = (identifier: DashboardVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { dashboardUid: uid } = identifier;
    dispatch(toKeyedAction(uid, variableEditorMounted({ name: getDashboardVariable(identifier).name })));
  };
};

export const variableEditorUnMount = (identifier: DashboardVariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { dashboardUid: uid } = identifier;
    dispatch(toKeyedAction(uid, variableEditorUnMounted(toVariablePayload(identifier))));
  };
};

export const onEditorUpdate = (identifier: DashboardVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    await dispatch(updateOptions(identifier));
    dispatch(switchToListMode(identifier.dashboardUid));
  };
};

export const changeVariableName = (identifier: DashboardVariableIdentifier, newName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    const { id, dashboardUid: uid } = identifier;
    let errorText = null;
    if (!newName.match(/^(?!__).*$/)) {
      errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
    }

    if (!newName.match(/^\w+$/)) {
      errorText = 'Only word and digit characters are allowed in variable names';
    }

    const variables = getDashboardVariables(uid, getState());
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

export const completeChangeVariableName = (
  identifier: DashboardVariableIdentifier,
  newName: string
): ThunkResult<void> => (dispatch, getState) => {
  const { dashboardUid: uid } = identifier;
  const originalVariable = getDashboardVariable(identifier, getState());
  if (originalVariable.name === newName) {
    dispatch(toKeyedAction(uid, changeVariableNameSucceeded(toVariablePayload(identifier, { newName }))));
    return;
  }
  const model = { ...cloneDeep(originalVariable), name: newName, id: newName };
  const global = originalVariable.global;
  const index = originalVariable.index;
  const renamedIdentifier = toDashboardVariableIdentifier(model);

  dispatch(toKeyedAction(uid, addVariable(toVariablePayload(renamedIdentifier, { global, index, model }))));
  dispatch(toKeyedAction(uid, changeVariableNameSucceeded(toVariablePayload(renamedIdentifier, { newName }))));
  dispatch(switchToEditMode(renamedIdentifier));
  dispatch(toKeyedAction(uid, removeVariable(toVariablePayload(identifier, { reIndex: false }))));
};

export const switchToNewMode = (uid: string, type: VariableType = 'query'): ThunkResult<void> => (
  dispatch,
  getState
) => {
  const id = getNextAvailableId(type, getDashboardVariables(uid, getState()));
  const identifier = { type, id, dashboardUid: uid };
  const global = false;
  const index = getNewDashboardVariableIndex(uid, getState());
  const model = cloneDeep(variableAdapters.get(type).initialState);
  model.id = id;
  model.name = id;
  model.dashboardUid = uid;
  dispatch(
    toKeyedAction(
      uid,
      addVariable(
        toVariablePayload<AddVariable>(identifier, { global, model, index })
      )
    )
  );
  dispatch(toKeyedAction(uid, setIdInEditor({ id: identifier.id })));
};

export const switchToEditMode = (identifier: DashboardVariableIdentifier): ThunkResult<void> => (dispatch) => {
  const { dashboardUid: uid } = identifier;
  dispatch(toKeyedAction(uid, setIdInEditor({ id: identifier.id })));
};

export const switchToListMode = (uid: string): ThunkResult<void> => (dispatch, getState) => {
  dispatch(toKeyedAction(uid, clearIdInEditor()));
  const state = getState();
  const variables = getDashboardEditorVariables(uid, state);
  const dashboard = state.dashboard.getModel();
  const { usages } = createUsagesNetwork(variables, dashboard);
  const usagesNetwork = transformUsagesToNetwork(usages);

  dispatch(toKeyedAction(uid, initInspect({ usages, usagesNetwork })));
};

export function getNextAvailableId(type: VariableType, variables: VariableModel[]): string {
  let counter = 0;
  let nextId = `${type}${counter}`;

  while (variables.find((variable) => variable.id === nextId)) {
    nextId = `${type}${++counter}`;
  }

  return nextId;
}
