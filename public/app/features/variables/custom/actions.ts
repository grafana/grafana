import { validateVariableSelectionState } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createCustomOptionsFromQuery } from './reducer';
import { KeyedVariableIdentifier } from '../state/types';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { toVariablePayload } from '../utils';

export const updateCustomVariableOptions = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { rootStateKey } = identifier;
    await dispatch(toKeyedAction(rootStateKey, createCustomOptionsFromQuery(toVariablePayload(identifier))));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
