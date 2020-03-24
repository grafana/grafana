import { ThunkResult } from '../../../types';
import { getVariable, getVariables, getNewVariabelIndex } from '../state/selectors';
import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  clearIdInEditor,
  setIdInEditor,
  variableEditorMounted,
  variableEditorUnMounted,
} from './reducer';
import { variableAdapters } from '../adapters';
import {
  AddVariable,
  NEW_VARIABLE_ID,
  toVariableIdentifier,
  toVariablePayload,
  VariableIdentifier,
} from '../state/types';
import cloneDeep from 'lodash/cloneDeep';
import { VariableType } from '../../templating/types';
import { addVariable, removeVariable, storeNewVariable } from '../state/sharedReducer';

export const variableEditorMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    dispatch(variableEditorMounted({ name: getVariable(identifier.id!).name }));
  };
};

export const variableEditorUnMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    dispatch(variableEditorUnMounted(toVariablePayload(identifier)));
    if (getState().templating.variables[NEW_VARIABLE_ID]) {
      dispatch(removeVariable(toVariablePayload({ type: identifier.type, id: NEW_VARIABLE_ID }, { reIndex: false })));
    }
  };
};

export const onEditorUpdate = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable(identifier.id!, getState());
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(switchToListMode());
  };
};

export const onEditorAdd = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const newVariableInState = getVariable(NEW_VARIABLE_ID, getState());
    const id = newVariableInState.name;
    dispatch(storeNewVariable(toVariablePayload({ type: identifier.type, id })));
    const variableInState = getVariable(id, getState());
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(switchToListMode());
    dispatch(removeVariable(toVariablePayload({ type: identifier.type, id: NEW_VARIABLE_ID }, { reIndex: false })));
  };
};

export const changeVariableName = (identifier: VariableIdentifier, newName: string): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variableInState = getVariable(identifier.id, getState());
    if (newName === variableInState.name) {
      return;
    }

    let errorText = null;
    if (!newName.match(/^(?!__).*$/)) {
      errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
    }

    if (!newName.match(/^\w+$/)) {
      errorText = 'Only word and digit characters are allowed in variable names';
    }

    const variables = getVariables(getState());
    const foundVariables = variables.filter(v => v.name === newName && v.id !== identifier.id);

    if (foundVariables.length) {
      errorText = 'Variable with the same name already exists';
    }

    if (errorText) {
      dispatch(changeVariableNameFailed({ newName, errorText }));
      return;
    }

    const thunkToCall = identifier.id === NEW_VARIABLE_ID ? completeChangeNewVariableName : completeChangeVariableName;
    dispatch(thunkToCall(identifier, newName));
  };
};

export const completeChangeNewVariableName = (
  identifier: VariableIdentifier,
  newName: string
): ThunkResult<void> => dispatch => {
  dispatch(changeVariableNameSucceeded(toVariablePayload(identifier, { newName })));
};

export const completeChangeVariableName = (identifier: VariableIdentifier, newName: string): ThunkResult<void> => (
  dispatch,
  getState
) => {
  const originalVariable = getVariable(identifier.id, getState());
  const model = { ...cloneDeep(originalVariable), name: newName, id: newName };
  const global = originalVariable.global;
  const index = originalVariable.index;
  const renamedIdentifier = toVariableIdentifier(model);

  dispatch(addVariable(toVariablePayload(renamedIdentifier, { global, index, model })));
  dispatch(changeVariableNameSucceeded(toVariablePayload(renamedIdentifier, { newName })));
  dispatch(switchToEditMode(renamedIdentifier));
  dispatch(removeVariable(toVariablePayload(identifier, { reIndex: false })));
};

export const switchToNewMode = (): ThunkResult<void> => (dispatch, getState) => {
  const type: VariableType = 'query';
  const id = NEW_VARIABLE_ID;
  const global = false;
  const model = cloneDeep(variableAdapters.get(type).initialState);
  const index = getNewVariabelIndex(getState());
  const identifier = { type, id };
  dispatch(
    addVariable(
      toVariablePayload<AddVariable>(identifier, { global, model, index })
    )
  );
  dispatch(setIdInEditor({ id: identifier.id }));
};

export const switchToEditMode = (identifier: VariableIdentifier): ThunkResult<void> => dispatch => {
  dispatch(setIdInEditor({ id: identifier.id }));
};

export const switchToListMode = (): ThunkResult<void> => dispatch => {
  dispatch(clearIdInEditor());
};
