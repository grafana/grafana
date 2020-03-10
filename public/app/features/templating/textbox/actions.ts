import { TextBoxVariableModel } from '../variable';
import { ThunkResult } from '../../../types';
import { getVariable } from '../state/selectors';
import { variableAdapters } from '../adapters';
import { createTextBoxOptions } from './reducer';
import { toVariablePayload, VariableIdentifier } from '../state/types';

export const updateTextBoxVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => {
  return async (dispatch, getState) => {
    await dispatch(createTextBoxOptions(toVariablePayload(identifier)));
    const variableInState = getVariable<TextBoxVariableModel>(identifier.uuid!, getState());
    await variableAdapters.get(identifier.type).setValue(variableInState, variableInState.options[0], true);
  };
};
