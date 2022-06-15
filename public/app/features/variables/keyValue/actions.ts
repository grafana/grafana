import { ThunkResult } from 'app/types';

import { variableUpdated } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable } from '../state/selectors';
import { removeVariable } from '../state/sharedReducer';
import { KeyedVariableIdentifier } from '../state/types';
import { KeyValueVariableModel } from '../types';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

import { updateKeyValueVariable } from './reducer';

export const setKeyValueVariableValue = (
  identifier: KeyedVariableIdentifier,
  value: string | null
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState()) as KeyValueVariableModel;
    dispatch(
      toKeyedAction(
        identifier.rootStateKey,
        updateKeyValueVariable(toVariablePayload(variable, { key: variable.key, value }))
      )
    );
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const removeKeyValueVariable = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    // Update variable value to null and emit change events to update url
    await dispatch(setKeyValueVariableValue(identifier, null));
    // Remove variable from the store
    await dispatch(
      toKeyedAction(identifier.rootStateKey, removeVariable(toVariablePayload(identifier, { reIndex: true })))
    );
  };
};
