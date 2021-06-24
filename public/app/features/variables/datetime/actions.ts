import { DateTimeVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getVariable } from '../state/selectors';
import { variableAdapters } from '../adapters';
import { createDateTimeOptions } from './reducer';
import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { setOptionFromUrl } from '../state/actions';
import { UrlQueryValue } from '@grafana/data';
import { changeVariableProp } from '../state/sharedReducer';
import { ensureStringValues } from '../utils';

export const updateDateTimeVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    await dispatch(createDateTimeOptions(toVariablePayload(identifier)));

    const variableInState = getVariable<DateTimeVariableModel>(identifier.id, getState());
    await variableAdapters.get(identifier.type).setValue(variableInState, variableInState.options[0], true);
  };
};

export const setDateTimeVariableOptionsFromUrl =
  (identifier: VariableIdentifier, urlValue: UrlQueryValue): ThunkResult<void> =>
  async (dispatch, getState) => {
    const variableInState = getVariable<DateTimeVariableModel>(identifier.id, getState());

    const stringUrlValue = ensureStringValues(urlValue);
    dispatch(changeVariableProp(toVariablePayload(variableInState, { propName: 'query', propValue: stringUrlValue })));

    await dispatch(setOptionFromUrl(toVariableIdentifier(variableInState), stringUrlValue));
  };
