import { validateVariableSelectionState } from '../state/actions';
import { ThunkResult } from 'app/types';
import { createCustomOptionsFromQuery } from './reducer';
import { DashboardVariableIdentifier } from '../state/types';
import { toUidAction } from '../state/dashboardVariablesReducer';
import { toVariablePayload } from '../utils';

export const updateCustomVariableOptions = (identifier: DashboardVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { dashboardUid: uid } = identifier;
    await dispatch(toUidAction(uid, createCustomOptionsFromQuery(toVariablePayload(identifier))));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
