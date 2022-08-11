import { ThunkResult } from 'app/types';

import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { KeyedVariableIdentifier } from '../state/types';
import { toVariablePayload } from '../utils';

import { createConstantOptionsFromQuery } from './reducer';

export const updateConstantVariableOptions = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch) => {
    const { rootStateKey } = identifier;
    await dispatch(toKeyedAction(rootStateKey, createConstantOptionsFromQuery(toVariablePayload(identifier))));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
