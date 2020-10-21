import { updateOptions } from '../state/actions';
import { QueryVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getVariable } from '../state/selectors';
import { addVariableEditorError, removeVariableEditorError } from '../editor/reducer';
import { toVariablePayload, VariableIdentifier } from '../state/types';
import { changeVariableProp } from '../state/sharedReducer';

export const legacyChangeQueryVariableQuery = (
  identifier: VariableIdentifier,
  query: any,
  definition: string
): ThunkResult<void> => async (dispatch, getState) => {
  const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
  if (typeof query === 'string' && query.match(new RegExp('\\$' + variableInState.name + '(/| |$)'))) {
    const errorText = 'Query cannot contain a reference to itself. Variable: $' + variableInState.name;
    dispatch(addVariableEditorError({ errorProp: 'query', errorText }));
    return;
  }

  dispatch(removeVariableEditorError({ errorProp: 'query' }));
  dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })));
  dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: definition })));
  await dispatch(updateOptions(identifier));
};
