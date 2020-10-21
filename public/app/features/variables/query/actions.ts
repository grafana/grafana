import { DataSourcePluginMeta, DataSourceSelectItem } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';

import { updateOptions } from '../state/actions';
import { QueryVariableModel } from '../types';
import { ThunkResult } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getVariable } from '../state/selectors';
import { addVariableEditorError, changeVariableEditorExtended, removeVariableEditorError } from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { hasLegacyVariableSupport } from '../guard';
import { importDataSourcePlugin } from '../../plugins/plugin_loader';
import { LegacyVariableQueryEditor } from '../editor/LegacyVariableQueryEditor';
import { variableQueryEditorFactory } from '../editor/factories';
import { Subscription } from 'rxjs';
import { variableQueryRunner } from './variableQueryRunner';
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
      const dataSource = await getDatasourceSrv().get(variableInState.datasource ?? '');

      // we need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
      // variable will have the wrong current value as input
      await new Promise((resolve, reject) => {
        const subscription: Subscription = new Subscription();
        const observer = variableQueryObserver(resolve, reject, subscription);
        const responseSubscription = variableQueryRunner.getResponse(identifier).subscribe(observer);
        subscription.add(responseSubscription);

        variableQueryRunner.queueRequest({ identifier, dataSource, searchFilter });
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

      if (hasLegacyVariableSupport(dataSource)) {
        const dsPlugin = await importDataSourcePlugin(dataSource.meta!);
        const VariableQueryEditor = dsPlugin.components.VariableQueryEditor ?? LegacyVariableQueryEditor;
        dispatch(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: VariableQueryEditor }));
        return;
      }

      const VariableQueryEditor = variableQueryEditorFactory(dataSource);
      dispatch(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: VariableQueryEditor }));
    } catch (err) {
      console.error(err);
    }
  };
};

export const changeQueryVariableQuery = (identifier: VariableIdentifier, query: any): ThunkResult<void> => async (
  dispatch,
  getState
) => {
  const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
  if (typeof query === 'string' && query.match(new RegExp('\\$' + variableInState.name + '(/| |$)'))) {
    const errorText = 'Query cannot contain a reference to itself. Variable: $' + variableInState.name;
    dispatch(addVariableEditorError({ errorProp: 'query', errorText }));
    return;
  }

  dispatch(removeVariableEditorError({ errorProp: 'query' }));
  dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query })));
  if (typeof query === 'string') {
    dispatch(changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: query })));
  }
  await dispatch(updateOptions(identifier));
};
