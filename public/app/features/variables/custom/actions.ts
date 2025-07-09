import { getTemplateSrv } from '@grafana/runtime';
import { ThunkResult } from 'app/types/store';

import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable } from '../state/selectors';
import { KeyedVariableIdentifier } from '../state/types';
import { toVariablePayload } from '../utils';

import { createCustomOptionsFromQuery } from './reducer';

export const updateCustomVariableOptions = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { rootStateKey } = identifier;
    const variable = getVariable(identifier, getState());
    if (variable.type !== 'custom') {
      return;
    }
    const query = getTemplateSrv().replace(variable.query);
    await dispatch(toKeyedAction(rootStateKey, createCustomOptionsFromQuery(toVariablePayload(identifier, query))));
    await dispatch(validateVariableSelectionState(identifier));
  };
};
