import {
  VariableIdentifier,
  toVariablePayload,
  validateVariableSelectionState,
  VariablePayload,
} from '../state/actions';
import { ThunkResult } from 'app/types';
import { createAction } from '@reduxjs/toolkit';

export const createCustomOptionsFromQuery = createAction<VariablePayload>('templating/createCustomOptionsFromQuery');

export const updateCustomVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    await dispatch(createCustomOptionsFromQuery(toVariablePayload(identifier)));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
