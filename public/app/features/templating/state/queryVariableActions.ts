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
import { QueryVariableModel, VariableRefresh } from '../variable';
import { ThunkResult, VariableQueryProps } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import appEvents from '../../../core/app_events';
import { AppEvents, DataSourceApi } from '@grafana/data';
import { importDataSourcePlugin } from '../../plugins/plugin_loader';
import DefaultVariableQueryEditor from '../DefaultVariableQueryEditor';
import { ComponentType } from 'react';
import { getVariable } from './selectors';

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

export const queryVariableActions: Record<string, ActionCreatorWithPayload<VariablePayload<any>>> = {
  [showQueryVariableDropDown.type]: showQueryVariableDropDown,
  [hideQueryVariableDropDown.type]: hideQueryVariableDropDown,
  [selectVariableOption.type]: selectVariableOption,
  [queryVariableDatasourceLoaded.type]: queryVariableDatasourceLoaded,
  [queryVariableEditorLoaded.type]: queryVariableEditorLoaded,
};

export const updateQueryVariableOptions = (
  variable: QueryVariableModel,
  searchFilter?: string,
  notifyAngular?: boolean
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variableInState = getVariable<QueryVariableModel>(variable.uuid);
    try {
      dispatch(updateVariableStarting(toVariablePayload(variable)));
      const dataSource = await getDatasourceSrv().get(variableInState.datasource);
      const queryOptions: any = { range: undefined, variableInState, searchFilter };
      if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
        queryOptions.range = getTimeSrv().timeRange();
      }
      const results = await dataSource.metricFindQuery(variableInState.query, queryOptions);
      await dispatch(updateVariableOptions(toVariablePayload(variableInState, results)));

      if (variable.useTags) {
        const tagResults = await dataSource.metricFindQuery(variableInState.tagsQuery, queryOptions);
        await dispatch(updateVariableTags(toVariablePayload(variableInState, tagResults)));
      }

      await dispatch(validateVariableSelectionState(variableInState));
      await dispatch(updateVariableCompleted(toVariablePayload(variableInState, { notifyAngular })));
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

export const changeQueryVariableDataSource = (variable: QueryVariableModel, name: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    try {
      const dataSource = await getDatasourceSrv().get(name);
      const dsPlugin = await importDataSourcePlugin(dataSource.meta);
      const VariableQueryEditor = dsPlugin.components.VariableQueryEditor ?? DefaultVariableQueryEditor;
      dispatch(queryVariableDatasourceLoaded(toVariablePayload(variable, dataSource)));
      dispatch(queryVariableEditorLoaded(toVariablePayload(variable, VariableQueryEditor)));
    } catch (err) {
      console.error(err);
    }
  };
};
