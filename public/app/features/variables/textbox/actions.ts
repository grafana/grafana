import { TextBoxVariableModel } from '../../templating/types';
import { ThunkResult } from '../../../types';
import { getVariable } from '../state/selectors';
import { variableAdapters } from '../adapters';
import { createTextBoxOptions } from './reducer';
import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { setOptionFromUrl } from '../state/actions';
import { UrlQueryValue } from '@grafana/data';
import { changeVariableProp } from '../state/sharedReducer';

export const updateTextBoxVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    await dispatch(createTextBoxOptions(toVariablePayload(identifier)));

    const variableInState = getVariable<TextBoxVariableModel>(identifier.id!, getState());
    await variableAdapters.get(identifier.type).setValue(variableInState, variableInState.options[0], true);
  };
};

export const setTextBoxVariableOptionsFromUrl = (
  identifier: VariableIdentifier,
  urlValue: UrlQueryValue
): ThunkResult<void> => async (dispatch, getState) => {
  const variableInState = getVariable<TextBoxVariableModel>(identifier.id!, getState());

  dispatch(changeVariableProp(toVariablePayload(variableInState, { propName: 'query', propValue: urlValue })));

  await dispatch(setOptionFromUrl(toVariableIdentifier(variableInState), urlValue));
};
