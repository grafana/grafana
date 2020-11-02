import { DataQuery, DataSourceApi, DataSourcePluginMeta, DataSourceSelectItem } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';

import { updateOptions } from '../state/actions';
import { QueryVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getVariable } from '../state/selectors';
import { addVariableEditorError, changeVariableEditorExtended, removeVariableEditorError } from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { hasLegacyVariableSupport, hasStandardVariableSupport } from '../guard';
import { variableQueryEditorFactory } from '../editor/factories';
import { Subscription } from 'rxjs';
import { getVariableQueryRunner } from './variableQueryRunner';
import { variableQueryObserver } from './variableQueryObserver';

export const updateQueryVariableOptions = (
  identifier: VariableIdentifier,
  searchFilter?: string
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
    try {
      if (getState().templating.editor.id === variableInState.id) {
        dispatch(removeVariableEditorError({ errorProp: 'update' }));
      }
      const datasource = await getDatasourceSrv().get(variableInState.datasource ?? '');
      dispatch(upgradeLegacyQueries(identifier, datasource));

      // we need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
      // variable will have the wrong current value as input
      await new Promise((resolve, reject) => {
        const subscription: Subscription = new Subscription();
        const observer = variableQueryObserver(resolve, reject, subscription);
        const responseSubscription = getVariableQueryRunner()
          .getResponse(identifier)
          .subscribe(observer);
        subscription.add(responseSubscription);

        getVariableQueryRunner().queueRequest({ identifier, datasource, searchFilter });
      });
    } catch (err) {
      const error = toDataQueryError(err);
      if (getState().templating.editor.id === variableInState.id) {
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
  const dataSources: DataSourceSelectItem[] = getDatasourceSrv()
    .getMetricSources()
    .filter(ds => !ds.meta.mixed && ds.value !== null);

  const defaultDatasource: DataSourceSelectItem = { name: '', value: '', meta: {} as DataSourcePluginMeta, sort: '' };
  const allDataSources = [defaultDatasource].concat(dataSources);
  dispatch(changeVariableEditorExtended({ propName: 'dataSources', propValue: allDataSources }));

  const variable = getVariable<QueryVariableModel>(identifier.id, getState());
  if (!variable.datasource) {
    return;
  }
  await dispatch(changeQueryVariableDataSource(toVariableIdentifier(variable), variable.datasource));
};

export const changeQueryVariableDataSource = (
  identifier: VariableIdentifier,
  name: string | null
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const dataSource = await getDatasourceSrv().get(name ?? '');
      dispatch(changeVariableEditorExtended({ propName: 'dataSource', propValue: dataSource }));

      const VariableQueryEditor = await variableQueryEditorFactory(dataSource);
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
  if (typeof query === 'string' && query.match(new RegExp('\\$' + variableInState.name + '(/| |$)'))) {
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

export function upgradeLegacyQueries(identifier: VariableIdentifier, datasource: DataSourceApi): ThunkResult<void> {
  return function(dispatch, getState) {
    if (hasLegacyVariableSupport(datasource)) {
      return;
    }

    if (!hasStandardVariableSupport(datasource)) {
      return;
    }

    const variable = getVariable<QueryVariableModel>(identifier.id, getState());
    if (isDataQuery(variable.query)) {
      return;
    }

    const query = {
      refId: `${datasource.name}-${identifier.id}-Variable-Query`,
      query: variable.query,
    };

    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })));
  };
}

function isDataQuery(query: any): query is DataQuery {
  if (!query) {
    return false;
  }

  return query.hasOwnProperty('refId') && typeof query.refId === 'string';
}
