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
import { AddVariable, NEW_VARIABLE_ID, toVariablePayload, VariableIdentifier } from '../state/types';
import cloneDeep from 'lodash/cloneDeep';
import { VariableType } from '../../templating/variable';
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
    const id = v4();
    dispatch(storeNewVariable(toVariablePayload({ type: identifier.type, id })));
    const variableInState = getVariable(id, getState());
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(switchToListMode());
    dispatch(removeVariable(toVariablePayload({ type: identifier.type, id: NEW_VARIABLE_ID }, { reIndex: false })));
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
    const stateVariables = variables.filter(v => v.name === newName && v.id !== identifier.id);

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
  const id = NEW_VARIABLE_ID;
  const global = false;
  const model = cloneDeep(variableAdapters.get(type).initialState);
  const index = Object.values(getState().templating.variables).length;
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
