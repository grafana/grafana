import { VariableIdentifier, updateVariableOptions, toVariablePayload } from '../state/actions';
import { ThunkResult } from 'app/types';
import { CustomVariableModel } from '../variable';
import { getVariable } from '../state/selectors';

/** EDITOR ACTIONS */
// export const initCustomVariableEditor = (identifier: VariableIdentifier): ThunkResult<void> => {
//   return (dispatch, getState) => {};
// };

/** VARIABLE ACTIONS */
export const updateCustomVariableOptions = (
  identifier: VariableIdentifier,
  query: string | null
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    /**
     * TODO:
     * I would like to move this to the reducer and dispatching the
     * dispatch(updateVariableOptions(toVariablePayload(variableInState, query: string)));
     * directly in the editor.
     */

    const variableInState = getVariable<CustomVariableModel>(identifier.uuid!, getState());

    const options = (query ?? '').match(/(?:\\,|[^,])+/g).map(text => {
      text = text.replace(/\\,/g, ',');
      return { text: text.trim(), value: text.trim(), selected: false };
    });

    dispatch(updateVariableOptions(toVariablePayload(variableInState, options)));
    //   return this.variableSrv.validateVariableSelectionState(this);
  };
};
