import { validateVariableSelectionState } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createMappingOptionsFromQuery } from './reducer';
import { toVariablePayload, VariableIdentifier } from '../state/types';

export const updateMappingVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    await dispatch(createMappingOptionsFromQuery(toVariablePayload(identifier)));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
