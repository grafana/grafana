import { validateVariableSelectionState } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createCustomOptionsFromQuery } from './reducer';
import { toVariablePayload, VariableIdentifier } from '../state/types';

export const updateCustomVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    await dispatch(createCustomOptionsFromQuery(toVariablePayload(identifier)));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
