import { validateVariableSelectionState } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createConstantOptionsFromQuery } from './reducer';
import { KeyedVariableIdentifier } from '../state/types';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { toVariablePayload } from '../utils';

export const updateConstantVariableOptions = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { rootStateKey } = identifier;
    await dispatch(toKeyedAction(rootStateKey, createConstantOptionsFromQuery(toVariablePayload(identifier))));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
