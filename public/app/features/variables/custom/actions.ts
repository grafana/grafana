import { ThunkResult } from 'app/types';

import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { KeyedVariableIdentifier } from '../state/types';
import { toVariablePayload } from '../utils';

import { createCustomOptionsFromQuery } from './reducer';

export const updateCustomVariableOptions = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { rootStateKey } = identifier;
    await dispatch(toKeyedAction(rootStateKey, createCustomOptionsFromQuery(toVariablePayload(identifier))));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
