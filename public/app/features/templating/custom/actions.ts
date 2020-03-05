import { toVariablePayload, validateVariableSelectionState, VariableIdentifier } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createCustomOptionsFromQuery } from './reducer';

export const updateCustomVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    await dispatch(createCustomOptionsFromQuery(toVariablePayload(identifier)));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
