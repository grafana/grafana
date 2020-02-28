import {
  VariableIdentifier,
  toVariablePayload,
  updateVariableQuery,
  validateVariableSelectionState,
} from '../state/actions';
import { ThunkResult } from 'app/types';
import { CustomVariableModel } from '../variable';
import { getVariable } from '../state/selectors';

export const updateCustomVariableOptions = (
  identifier: VariableIdentifier,
  query: string | null
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable<CustomVariableModel>(identifier.uuid, getState());
    await dispatch(updateVariableQuery(toVariablePayload(variable, query)));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
