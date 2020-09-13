import { validateVariableSelectionState } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createConstantOptionsFromQuery } from './reducer';
import { toVariablePayload, VariableIdentifier } from '../state/types';

export const updateConstantVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    await dispatch(createConstantOptionsFromQuery(toVariablePayload(identifier)));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
