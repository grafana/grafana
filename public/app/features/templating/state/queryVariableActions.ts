import { ActionCreatorWithPayload, createAction } from '@reduxjs/toolkit';
import {
  SelectVariableOption,
  toVariablePayload,
  updateVariableCompleted,
  updateVariableFailed,
  updateVariableOptions,
  updateVariableStarting,
  updateVariableTags,
  validateVariableSelectionState,
  VariablePayload,
} from './actions';
import { QueryVariableModel, VariableRefresh, VariableTag } from '../variable';
import { ThunkResult, VariableQueryProps } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import appEvents from '../../../core/app_events';
import { AppEvents, DataSourceApi, DataSourcePluginMeta } from '@grafana/data';
import { importDataSourcePlugin } from '../../plugins/plugin_loader';
import DefaultVariableQueryEditor from '../DefaultVariableQueryEditor';
import { ComponentType } from 'react';
import { getVariable } from './selectors';

// TODO: move to a better place
interface TagWithValues {
  tag: VariableTag;
  values: string[];
}

export const showQueryVariableDropDown = createAction<VariablePayload<undefined>>(
  'templating/showQueryVariableDropDown'
);

export const hideQueryVariableDropDown = createAction<VariablePayload<undefined>>(
  'templating/hideQueryVariableDropDown'
);

export const selectVariableOption = createAction<VariablePayload<SelectVariableOption>>(
  'templating/selectVariableOption'
);

export const queryVariableDatasourceLoaded = createAction<VariablePayload<DataSourceApi>>(
  'templating/queryVariableDatasourceLoaded'
);

export const queryVariableEditorLoaded = createAction<VariablePayload<ComponentType<VariableQueryProps>>>(
  'templating/queryVariableEditorLoaded'
);

export const selectVariableTagWithValues = createAction<VariablePayload<TagWithValues>>('templating/selectVariableTag');
export const deselectVariableTag = createAction<VariablePayload<VariableTag>>('templating/deselectVariableTag');

export const queryVariableActions: Record<string, ActionCreatorWithPayload<VariablePayload<any>>> = {
  [showQueryVariableDropDown.type]: showQueryVariableDropDown,
  [hideQueryVariableDropDown.type]: hideQueryVariableDropDown,
  [selectVariableOption.type]: selectVariableOption,
  [queryVariableDatasourceLoaded.type]: queryVariableDatasourceLoaded,
  [queryVariableEditorLoaded.type]: queryVariableEditorLoaded,
  [selectVariableTagWithValues.type]: selectVariableTagWithValues,
  [deselectVariableTag.type]: deselectVariableTag,
};

export const updateQueryVariableOptions = (
  variable: QueryVariableModel,
  searchFilter?: string,
  notifyAngular?: boolean
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable<QueryVariableModel>(variable.uuid ?? '');
    try {
      dispatch(updateVariableStarting(toVariablePayload(variable)));
      const dataSource = await getDatasourceSrv().get(variableInState.datasource ?? '');
      const queryOptions: any = { range: undefined, variableInState, searchFilter };
      if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
        queryOptions.range = getTimeSrv().timeRange();
      }

      if (!dataSource.metricFindQuery) {
        return;
      }

      const results = await dataSource.metricFindQuery(variableInState.query, queryOptions);
      await dispatch(updateVariableOptions(toVariablePayload(variableInState, results)));

      if (variable.useTags) {
        const tagResults = await dataSource.metricFindQuery(variableInState.tagsQuery, queryOptions);
        await dispatch(updateVariableTags(toVariablePayload(variableInState, tagResults)));
      }

      await dispatch(validateVariableSelectionState(variableInState));
      await dispatch(
        updateVariableCompleted(toVariablePayload(variableInState, { notifyAngular: notifyAngular ?? false }))
      );
    } catch (err) {
      if (err.data && err.data.message) {
        err.message = err.data.message;
      }
      dispatch(updateVariableFailed(toVariablePayload(variableInState, err)));
      appEvents.emit(AppEvents.alertError, [
        'Templating',
        'Template variables could not be initialized: ' + err.message,
      ]);
    }
  };
};

export const initQueryVariableEditor = (variable: QueryVariableModel): ThunkResult<void> => {
  return async (dispatch, getState) => {
    dispatch(changeQueryVariableDataSource(variable, variable.datasource));
  };
};

export const changeQueryVariableDataSource = (variable: QueryVariableModel, name: string | null): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const dataSource = await getDatasourceSrv().get(name ?? '');
      const dsPlugin = await importDataSourcePlugin(dataSource.meta ?? ({} as DataSourcePluginMeta));
      const VariableQueryEditor = dsPlugin.components.VariableQueryEditor ?? DefaultVariableQueryEditor;
      dispatch(queryVariableDatasourceLoaded(toVariablePayload(variable, dataSource)));
      dispatch(queryVariableEditorLoaded(toVariablePayload(variable, VariableQueryEditor)));
    } catch (err) {
      console.error(err);
    }
  };
};

export const selectVariableTag = (uuid: string, tag: VariableTag): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const variable = getVariable<QueryVariableModel>(uuid, getState());

      if (tag.values) {
        return dispatch(selectVariableTagWithValues(toVariablePayload(variable, { tag, values: tag.values })));
      }

      const datasource = await getDatasourceSrv().get(variable.datasource ?? '');
      const query = variable.tagValuesQuery.replace('$tag', tag.text.toString());
      const result = await metricFindQuery(datasource, query, variable);
      const values = result?.map((value: any) => value.text) || [];
      return dispatch(selectVariableTagWithValues(toVariablePayload(variable, { tag, values })));
    } catch (error) {
      return console.error(error);
    }
  };
};

function metricFindQuery(datasource: any, query: string, variable: QueryVariableModel, searchFilter?: string) {
  const options: any = { range: undefined, variable, searchFilter };

  if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
    options.range = getTimeSrv().timeRange();
  }

  return datasource.metricFindQuery(query, options);
}
