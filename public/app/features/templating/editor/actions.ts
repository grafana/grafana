import { ThunkResult } from '../../../types';
import { getVariable, getVariables } from '../state/selectors';
import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  clearIdInEditor,
  setIdInEditor,
  variableEditorMounted,
  variableEditorUnMounted,
} from './reducer';
import { variableAdapters } from '../adapters';
import { v4 } from 'uuid';
import { AddVariable, EMPTY_UUID, toVariablePayload, VariableIdentifier } from '../state/types';
import cloneDeep from 'lodash/cloneDeep';
import { VariableType } from '../variable';
import { addVariable, removeVariable, storeNewVariable } from '../state/sharedReducer';

export const variableEditorMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    dispatch(variableEditorMounted({ name: getVariable(identifier.uuid!).name }));
  };
};

export const variableEditorUnMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    dispatch(variableEditorUnMounted(toVariablePayload(identifier)));
    if (getState().templating.variables[EMPTY_UUID]) {
      dispatch(removeVariable(toVariablePayload({ type: identifier.type, uuid: EMPTY_UUID }, { reIndex: false })));
    }
  };
};

export const onEditorUpdate = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable(identifier.uuid!, getState());
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(switchToListMode());
  };
};

export const onEditorAdd = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const uuid = v4();
    dispatch(storeNewVariable(toVariablePayload({ type: identifier.type, uuid })));
    const variableInState = getVariable(uuid, getState());
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(switchToListMode());
    dispatch(removeVariable(toVariablePayload({ type: identifier.type, uuid: EMPTY_UUID }, { reIndex: false })));
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
    const stateVariables = variables.filter(v => v.name === newName && v.uuid !== identifier.uuid);

    if (stateVariables.length) {
      errorText = 'Variable with the same name already exists';
    }

    if (errorText) {
      dispatch(changeVariableNameFailed({ newName, errorText }));
    }

    if (!errorText) {
      dispatch(changeVariableNameSucceeded(toVariablePayload(identifier, newName)));
    }
  };
};

export const switchToNewMode = (): ThunkResult<void> => (dispatch, getState) => {
  const type: VariableType = 'query';
  const uuid = EMPTY_UUID;
  const global = false;
  const model = cloneDeep(variableAdapters.get(type).initialState);
  const index = Object.values(getState().templating.variables).length;
  const identifier = { type, uuid };
  dispatch(
    addVariable(
      toVariablePayload<AddVariable>(identifier, { global, model, index })
    )
  );
  dispatch(setIdInEditor({ id: identifier.uuid }));
};

export const switchToEditMode = (identifier: VariableIdentifier): ThunkResult<void> => dispatch => {
  dispatch(setIdInEditor({ id: identifier.uuid }));
};

export const switchToListMode = (): ThunkResult<void> => dispatch => {
  dispatch(clearIdInEditor());
};
