import { getTemplateSrv, toDataQueryError } from '@grafana/runtime';

import { updateOptions, validateVariableSelectionState } from '../state/actions';
import { QueryVariableModel, VariableRefresh } from '../types';
import { ThunkResult } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { getVariable } from '../state/selectors';
import { addVariableEditorError, removeVariableEditorError } from '../editor/reducer';
import { updateVariableOptions, updateVariableTags } from './reducer';
import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { changeVariableProp } from '../state/sharedReducer';

export const legacyUpdateQueryVariableOptions = (
  identifier: VariableIdentifier,
  searchFilter?: string
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
    try {
      const beforeUid = getState().templating.transaction.uid;
      if (getState().templating.editor.id === variableInState.id) {
        dispatch(removeVariableEditorError({ errorProp: 'update' }));
      }
      const dataSource = await getDatasourceSrv().get(variableInState.datasource ?? '');
      const queryOptions: any = { range: undefined, variable: variableInState, searchFilter };
      if (variableInState.refresh === VariableRefresh.onTimeRangeChanged) {
        queryOptions.range = getTimeSrv().timeRange();
      }

      if (!dataSource.metricFindQuery) {
        return;
      }

      const results = await dataSource.metricFindQuery(variableInState.query, queryOptions);

      const afterUid = getState().templating.transaction.uid;
      if (beforeUid !== afterUid) {
        // we started another batch before this metricFindQuery finished let's abort
        return;
      }

      const templatedRegex = getTemplatedRegex(variableInState);
      await dispatch(updateVariableOptions(toVariablePayload(variableInState, { results, templatedRegex })));

      if (variableInState.useTags) {
        const tagResults = await dataSource.metricFindQuery(variableInState.tagsQuery, queryOptions);
        await dispatch(updateVariableTags(toVariablePayload(variableInState, tagResults)));
      }

      // If we are searching options there is no need to validate selection state
      // This condition was added to as validateVariableSelectionState will update the current value of the variable
      // So after search and selection the current value is already update so no setValue, refresh & url update is performed
      // The if statement below fixes https://github.com/grafana/grafana/issues/25671
      if (!searchFilter) {
        await dispatch(validateVariableSelectionState(toVariableIdentifier(variableInState)));
      }
    } catch (err) {
      const error = toDataQueryError(err);
      if (getState().templating.editor.id === variableInState.id) {
        dispatch(addVariableEditorError({ errorProp: 'update', errorText: error.message }));
      }

      throw error;
    }
  };
};

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

const getTemplatedRegex = (variable: QueryVariableModel): string => {
  if (!variable) {
    return '';
  }

  if (!variable.regex) {
    return '';
  }

  return getTemplateSrv().replace(variable.regex, {}, 'regex');
};
