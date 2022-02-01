import { Subscription } from 'rxjs';
import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/data';

import { updateOptions } from '../state/actions';
import { QueryVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getVariable } from '../state/selectors';
import {
  addVariableEditorError,
  changeVariableEditorExtended,
  removeVariableEditorError,
  VariableEditorState,
} from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { getVariableQueryEditor } from '../editor/getVariableQueryEditor';
import { getVariableQueryRunner } from './VariableQueryRunner';
import { variableQueryObserver } from './variableQueryObserver';
import { QueryVariableEditorState } from './reducer';
import { hasOngoingTransaction } from '../utils';

export const updateQueryVariableOptions = (
  identifier: VariableIdentifier,
  searchFilter?: string
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      if (!hasOngoingTransaction(getState())) {
        // we might have cancelled a batch so then variable state is removed
        return;
      }

      const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
      if (getState().templating.editor.id === variableInState.id) {
        dispatch(removeVariableEditorError({ errorProp: 'update' }));
      }
      const datasource = await getDataSourceSrv().get(variableInState.datasource ?? '');

      // We need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
      // variable will have the wrong current value as input
      await new Promise((resolve, reject) => {
        const subscription: Subscription = new Subscription();
        const observer = variableQueryObserver(resolve, reject, subscription);
        const responseSubscription = getVariableQueryRunner().getResponse(identifier).subscribe(observer);
        subscription.add(responseSubscription);

        getVariableQueryRunner().queueRequest({ identifier, datasource, searchFilter });
      });
    } catch (err) {
      const error = toDataQueryError(err);
      if (getState().templating.editor.id === identifier.id) {
        dispatch(addVariableEditorError({ errorProp: 'update', errorText: error.message }));
      }

      throw error;
    }
  };
};

export const initQueryVariableEditor = (identifier: VariableIdentifier): ThunkResult<void> => async (
  dispatch,
  getState
) => {
  const variable = getVariable<QueryVariableModel>(identifier.id, getState());
  await dispatch(changeQueryVariableDataSource(toVariableIdentifier(variable), variable.datasource));
};

export const changeQueryVariableDataSource = (
  identifier: VariableIdentifier,
  name: DataSourceRef | null
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const editorState = getState().templating.editor as VariableEditorState<QueryVariableEditorState>;
      const previousDatasource = editorState.extended?.dataSource;
      const dataSource = await getDataSourceSrv().get(name ?? '');
      if (previousDatasource && previousDatasource.type !== dataSource?.type) {
        dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: '' })));
      }
      dispatch(changeVariableEditorExtended({ propName: 'dataSource', propValue: dataSource }));

      const VariableQueryEditor = await getVariableQueryEditor(dataSource);
      dispatch(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: VariableQueryEditor }));
    } catch (err) {
      console.error(err);
    }
  };
};

export const changeQueryVariableQuery = (
  identifier: VariableIdentifier,
  query: any,
  definition?: string
): ThunkResult<void> => async (dispatch, getState) => {
  const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
  if (hasSelfReferencingQuery(variableInState.name, query)) {
    const errorText = 'Query cannot contain a reference to itself. Variable: $' + variableInState.name;
    dispatch(addVariableEditorError({ errorProp: 'query', errorText }));
    return;
  }

  dispatch(removeVariableEditorError({ errorProp: 'query' }));
  dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })));

  if (definition) {
    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: definition })));
  } else if (typeof query === 'string') {
    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: query })));
  }

  await dispatch(updateOptions(identifier));
};

export function hasSelfReferencingQuery(name: string, query: any): boolean {
  if (typeof query === 'string' && query.match(new RegExp('\\$' + name + '(/| |$)'))) {
    return true;
  }

  const flattened = flattenQuery(query);

  for (let prop in flattened) {
    if (flattened.hasOwnProperty(prop)) {
      const value = flattened[prop];
      if (typeof value === 'string' && value.match(new RegExp('\\$' + name + '(/| |$)'))) {
        return true;
      }
    }
  }

  return false;
}

/*
 * Function that takes any object and flattens all props into one level deep object
 * */
export function flattenQuery(query: any): any {
  if (typeof query !== 'object') {
    return { query };
  }

  const keys = Object.keys(query);
  const flattened = keys.reduce((all, key) => {
    const value = query[key];
    if (typeof value !== 'object') {
      all[key] = value;
      return all;
    }

    const result = flattenQuery(value);
    for (let childProp in result) {
      if (result.hasOwnProperty(childProp)) {
        all[`${key}_${childProp}`] = result[childProp];
      }
    }

    return all;
  }, {} as Record<string, any>);

  return flattened;
}
