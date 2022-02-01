import { TextBoxVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getVariable } from '../state/selectors';
import { variableAdapters } from '../adapters';
import { createTextBoxOptions } from './reducer';
import { KeyedVariableIdentifier } from '../state/types';
import { setOptionFromUrl } from '../state/actions';
import { UrlQueryValue } from '@grafana/data';
import { changeVariableProp } from '../state/sharedReducer';
import { ensureStringValues, toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { toKeyedAction } from '../state/keyedVariablesReducer';

export const updateTextBoxVariableOptions = (identifier: KeyedVariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { stateKey, type } = identifier;
    dispatch(toKeyedAction(stateKey, createTextBoxOptions(toVariablePayload(identifier))));

    const variableInState = getVariable<TextBoxVariableModel>(identifier, getState());
    await variableAdapters.get(type).setValue(variableInState, variableInState.options[0], true);
  };
};

export const setTextBoxVariableOptionsFromUrl = (
  identifier: KeyedVariableIdentifier,
  urlValue: UrlQueryValue
): ThunkResult<void> => async (dispatch, getState) => {
  const { stateKey } = identifier;
  const variableInState = getVariable<TextBoxVariableModel>(identifier, getState());

  const stringUrlValue = ensureStringValues(urlValue);
  dispatch(
    toKeyedAction(
      stateKey,
      changeVariableProp(toVariablePayload(variableInState, { propName: 'query', propValue: stringUrlValue }))
    )
  );

  await dispatch(setOptionFromUrl(toKeyedVariableIdentifier(variableInState), stringUrlValue));
};
