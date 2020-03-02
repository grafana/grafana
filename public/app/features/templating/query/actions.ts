import { createAction } from '@reduxjs/toolkit';
import { AppEvents, DataSourcePluginMeta, DataSourceSelectItem } from '@grafana/data';

import {
  selectVariableOption,
  toVariableIdentifier,
  toVariablePayload,
  updateVariableOptions,
  updateVariableTags,
  validateVariableSelectionState,
  VariableIdentifier,
  VariablePayload,
} from '../state/actions';
import { QueryVariableModel, VariableRefresh, VariableTag, VariableWithMultiSupport } from '../variable';
import { ThunkResult } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import appEvents from '../../../core/app_events';
import { importDataSourcePlugin } from '../../plugins/plugin_loader';
import DefaultVariableQueryEditor from '../DefaultVariableQueryEditor';
import { getVariable } from '../state/selectors';
import { getQueryHasSearchFilter } from './reducer';
import { variableAdapters } from '../adapters';
import { addVariableEditorError, changeVariableEditorExtended, removeVariableEditorError } from '../editor/reducer';

export const changeQueryVariableHighlightIndex = createAction<VariablePayload<number>>(
  'templating/changeQueryVariableHighlightIndex'
);

export const toggleVariableTag = createAction<VariablePayload<VariableTag>>('templating/toggleVariableTag');

export const changeQueryVariableSearchQuery = createAction<VariablePayload<string>>(
  'templating/changeQueryVariableSearchQuery'
);

export const updateQueryVariableOptions = (
  identifier: VariableIdentifier,
  searchFilter?: string
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable<QueryVariableModel>(identifier.uuid!, getState());
    try {
      await dispatch(removeVariableEditorError({ errorProp: 'update' }));
      const dataSource = await getDatasourceSrv().get(variableInState.datasource ?? '');
      const queryOptions: any = { range: undefined, variable: variableInState, searchFilter };
      if (variableInState.refresh === VariableRefresh.onTimeRangeChanged) {
        queryOptions.range = getTimeSrv().timeRange();
      }

      if (!dataSource.metricFindQuery) {
        return;
      }

      const results = await dataSource.metricFindQuery(variableInState.query, queryOptions);
      await dispatch(updateVariableOptions(toVariablePayload(variableInState, results)));

      if (variableInState.useTags) {
        const tagResults = await dataSource.metricFindQuery(variableInState.tagsQuery, queryOptions);
        await dispatch(updateVariableTags(toVariablePayload(variableInState, tagResults)));
      }

      await dispatch(validateVariableSelectionState(toVariableIdentifier(variableInState)));
    } catch (err) {
      console.error(err);
      if (err.data && err.data.message) {
        err.message = err.data.message;
      }
      dispatch(addVariableEditorError({ errorProp: 'update', errorText: err.message }));
      appEvents.emit(AppEvents.alertError, [
        'Templating',
        'Template variables could not be initialized: ' + err.message,
      ]);
    }
  };
};

export const initQueryVariableEditor = (identifier: VariableIdentifier): ThunkResult<void> => async (
  dispatch,
  getState
) => {
  const dataSources: DataSourceSelectItem[] = await getDatasourceSrv()
    .getMetricSources()
    .filter(ds => !ds.meta.mixed && ds.value !== null);
  const defaultDatasource: DataSourceSelectItem = { name: '', value: '', meta: {} as DataSourcePluginMeta, sort: '' };
  const allDataSources = [defaultDatasource].concat(dataSources);
  dispatch(changeVariableEditorExtended({ propName: 'dataSources', propValue: allDataSources }));

  const variable = getVariable<QueryVariableModel>(identifier.uuid!, getState());
  if (!variable.datasource) {
    return;
  }
  dispatch(changeQueryVariableDataSource(toVariableIdentifier(variable), variable.datasource));
};

export const changeQueryVariableDataSource = (
  identifier: VariableIdentifier,
  name: string | null
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const dataSource = await getDatasourceSrv().get(name ?? '');
      const dsPlugin = await importDataSourcePlugin(dataSource.meta!);
      const VariableQueryEditor = dsPlugin.components.VariableQueryEditor ?? DefaultVariableQueryEditor;
      dispatch(changeVariableEditorExtended({ propName: 'dataSource', propValue: dataSource }));
      dispatch(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: VariableQueryEditor }));
    } catch (err) {
      console.error(err);
    }
  };
};

export const selectVariableOptionByHighlightIndex = (): ThunkResult<void> => {
  return (dispatch, getState) => {
    try {
      const { uuid, highlightIndex } = getState().optionsPicker;
      const variable = getVariable<VariableWithMultiSupport>(uuid, getState());
      const option = variable.options[highlightIndex];
      const data = { option, forceSelect: false, clearOthers: false };
      dispatch(selectVariableOption(toVariablePayload(variable, data)));
    } catch (error) {
      console.error(error);
    }
  };
};

export const toggleTag = (identifier: VariableIdentifier, tag: VariableTag): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const variable = getVariable<QueryVariableModel>(identifier.uuid, getState());

      if (tag.values) {
        return dispatch(toggleVariableTag(toVariablePayload(variable, tag)));
      }

      const datasource = await getDatasourceSrv().get(variable.datasource ?? '');
      const query = variable.tagValuesQuery.replace('$tag', tag.text.toString());
      const result = await metricFindQuery(datasource, query, variable);
      const values = result?.map((value: any) => value.text) || [];
      return dispatch(toggleVariableTag(toVariablePayload(variable, { ...tag, values })));
    } catch (error) {
      return console.error(error);
    }
  };
};

export const searchQueryChanged = (searchQuery: string): ThunkResult<void> => async (dispatch, getState) => {
  const { uuid } = getState().optionsPicker;
  const variable = getVariable<QueryVariableModel>(uuid, getState());

  if (getQueryHasSearchFilter(variable)) {
    await variableAdapters.get(variable.type).updateOptions(variable, searchQuery);
    // TODO: copy new options from variable to picker state if it is open.
  }
};

function metricFindQuery(datasource: any, query: string, variable: QueryVariableModel, searchFilter?: string) {
  const options: any = { range: undefined, variable, searchFilter };

  if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
    options.range = getTimeSrv().timeRange();
  }

  return datasource.metricFindQuery(query, options);
}
