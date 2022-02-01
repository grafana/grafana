import { TextBoxVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getDashboardVariable } from '../state/selectors';
import { variableAdapters } from '../adapters';
import { createTextBoxOptions } from './reducer';
import { DashboardVariableIdentifier } from '../state/types';
import { setOptionFromUrl } from '../state/actions';
import { UrlQueryValue } from '@grafana/data';
import { changeVariableProp } from '../state/sharedReducer';
import { ensureStringValues, toDashboardVariableIdentifier, toVariablePayload } from '../utils';
import { toKeyedAction } from '../state/keyedVariablesReducer';

export const updateTextBoxVariableOptions = (identifier: DashboardVariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { dashboardUid: uid, type } = identifier;
    dispatch(toKeyedAction(uid, createTextBoxOptions(toVariablePayload(identifier))));

    const variableInState = getDashboardVariable<TextBoxVariableModel>(identifier, getState());
    await variableAdapters.get(type).setValue(variableInState, variableInState.options[0], true);
  };
};

export const setTextBoxVariableOptionsFromUrl = (
  identifier: DashboardVariableIdentifier,
  urlValue: UrlQueryValue
): ThunkResult<void> => async (dispatch, getState) => {
  const { dashboardUid: uid } = identifier;
  const variableInState = getDashboardVariable<TextBoxVariableModel>(identifier, getState());

  const stringUrlValue = ensureStringValues(urlValue);
  dispatch(
    toKeyedAction(
      uid,
      changeVariableProp(toVariablePayload(variableInState, { propName: 'query', propValue: stringUrlValue }))
    )
  );

  await dispatch(setOptionFromUrl(toDashboardVariableIdentifier(variableInState), stringUrlValue));
};
