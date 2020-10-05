import { Subject, Subscription } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import {
  CoreApp,
  DataQueryRequest,
  DataSourceApi,
  DataSourcePluginMeta,
  DataSourceSelectItem,
  DefaultTimeRange,
} from '@grafana/data';
import { getTemplateSrv, toDataQueryError } from '@grafana/runtime';

import { updateOptions, validateVariableSelectionState } from '../state/actions';
import { QueryVariableModel, VariableRefresh } from '../types';
import { ThunkResult } from '../../../types';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { importDataSourcePlugin } from '../../plugins/plugin_loader';
import DefaultVariableQueryEditor from '../editor/DefaultVariableQueryEditor';
import { getVariable } from '../state/selectors';
import { addVariableEditorError, changeVariableEditorExtended, removeVariableEditorError } from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { updateVariableOptions, updateVariableTags } from './reducer';
import { toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import { runRequest } from '../../dashboard/state/runRequest';
import { dispatch, getState } from '../../../store/store';

const updateOptionsRequests = new Subject<{
  identifier: VariableIdentifier;
  dataSource: DataSourceApi;
  searchFilter?: string;
}>();

updateOptionsRequests.subscribe(args => {
  const { dataSource, identifier, searchFilter } = args;
  const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
  try {
    const range =
      variableInState.refresh === VariableRefresh.onTimeRangeChanged ? getTimeSrv().timeRange() : DefaultTimeRange;
    const targets = [
      {
        datasource: dataSource.name,
        refId: `${dataSource.name}-${variableInState.id}`,
        variableQuery: variableInState.query,
      },
    ];

    const request: DataQueryRequest = {
      targets,
      app: CoreApp.Variables,
      range,
      scopedVars: {
        searchFilter: { text: searchFilter ?? '', value: searchFilter ?? '' },
        variable: { text: variableInState.current.text, value: variableInState.current.value },
      },
      requestId: uuidv4(),
      intervalMs: 0,
      timezone: 'utc',
      interval: '',
      startTime: Date.now(),
    };

    const subscriptions = new Subscription();
    subscriptions.add(
      runRequest(dataSource, request)
        .pipe(
          map(panelData => panelData.series),
          dataSource.variables!.toMetricFindValues(),
          takeUntil(
            updateOptionsRequests.pipe(
              filter(args => {
                let cancelRequest = false;

                if (args.identifier.id === identifier.id) {
                  cancelRequest = true;
                }

                return cancelRequest;
              })
            )
          )
        )
        .subscribe({
          next: results => {
            console.log(`results from ${identifier.id}`, results);
            const templatedRegex = getTemplatedRegex(variableInState);
            dispatch(updateVariableOptions(toVariablePayload(variableInState, { results, templatedRegex })));
          },
          error: err => {
            throw err;
          },
          complete: () => {
            console.log(`complete from ${identifier.id}`);
            subscriptions.unsubscribe();
          },
        })
    );
  } catch (err) {
    console.error(err);
    if (err.data && err.data.message) {
      err.message = err.data.message;
    }
    if (getState().templating.editor.id === identifier.id) {
      dispatch(addVariableEditorError({ errorProp: 'update', errorText: err.message }));
    }
  }
});

export const updateOptionsFromMetricFindValue = (
  identifier: VariableIdentifier,
  dataSource: DataSourceApi,
  searchFilter?: string
): ThunkResult<void> => async (dispatch, getState) => {
  const variableInState = getVariable<QueryVariableModel>(identifier.id, getState());
  try {
    const beforeUid = getState().templating.transaction.uid;

    if (!dataSource.metricFindQuery) {
      return;
    }

    const results = await dataSource.metricFindQuery(
      variableInState.query,
      getLegacyQueryOptions(variableInState, searchFilter)
    );

    const afterUid = getState().templating.transaction.uid;
    if (beforeUid !== afterUid) {
      // we started another batch before this metricFindQuery finished let's abort
      return;
    }

    const templatedRegex = getTemplatedRegex(variableInState);
    await dispatch(updateVariableOptions(toVariablePayload(variableInState, { results, templatedRegex })));
  } catch (err) {
    console.error(err);
    if (err.data && err.data.message) {
      err.message = err.data.message;
    }
    if (getState().templating.editor.id === identifier.id) {
      dispatch(addVariableEditorError({ errorProp: 'update', errorText: err.message }));
    }
  }
};

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

      if (dataSource.variables) {
        updateOptionsRequests.next({ identifier, dataSource, searchFilter });
      } else {
        await dispatch(updateOptionsFromMetricFindValue(identifier, dataSource, searchFilter));
      }

      if (variableInState.useTags && dataSource.metricFindQuery) {
        const tagResults = await dataSource.metricFindQuery(
          variableInState.tagsQuery,
          getLegacyQueryOptions(variableInState, searchFilter)
        );
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
      const dsPlugin = await importDataSourcePlugin(dataSource.meta!);
      const VariableQueryEditor = dsPlugin.components.VariableQueryEditor ?? DefaultVariableQueryEditor;
      dispatch(changeVariableEditorExtended({ propName: 'dataSource', propValue: dataSource }));
      dispatch(changeVariableEditorExtended({ propName: 'VariableQueryEditor', propValue: VariableQueryEditor }));
    } catch (err) {
      console.error(err);
    }
  };
};

export const changeQueryVariableQuery = (
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

const getLegacyQueryOptions = (variable: QueryVariableModel, searchFilter?: string) => {
  const queryOptions: any = { range: undefined, variable, searchFilter };
  if (variable.refresh === VariableRefresh.onTimeRangeChanged) {
    queryOptions.range = getTimeSrv().timeRange();
  }

  return queryOptions;
};
