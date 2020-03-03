import { ThunkResult } from '../../../types';
import { getVariable, getVariables } from '../state/selectors';
import {
  changeVariableNameFailed,
  changeVariableNameSucceeded,
  variableEditorMounted,
  variableEditorUnMounted,
} from './reducer';
import { storeNewVariable, toVariablePayload, VariableIdentifier } from '../state/actions';
import { variableAdapters } from '../adapters';
import { v4 } from 'uuid';
import { changeToEditorListMode } from '../state/uuidInEditorReducer';

export const variableEditorMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    dispatch(variableEditorMounted(getVariable(identifier.uuid!).name));
  };
};

export const variableEditorUnMount = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    dispatch(variableEditorUnMounted(toVariablePayload(identifier)));
  };
};

export const onEditorUpdate = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable(identifier.uuid!, getState());
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(changeToEditorListMode());
  };
};

export const onEditorAdd = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const uuid = v4();
    dispatch(storeNewVariable(toVariablePayload({ type: identifier.type, uuid })));
    const variableInState = getVariable(uuid, getState());
    await variableAdapters.get(variableInState.type).updateOptions(variableInState);
    dispatch(changeToEditorListMode());
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
