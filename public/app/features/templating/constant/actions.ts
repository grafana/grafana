import {
  toVariablePayload,
  validateVariableSelectionState,
  VariableIdentifier,
  VariablePayload,
} from '../state/actions';
import { ThunkResult } from 'app/types';
import { createAction } from '@reduxjs/toolkit';

export const createConstantOptionsFromQuery = createAction<VariablePayload>('templating/createCustomOptionsFromQuery');

export const updateConstantVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async dispatch => {
    await dispatch(createConstantOptionsFromQuery(toVariablePayload(identifier)));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
