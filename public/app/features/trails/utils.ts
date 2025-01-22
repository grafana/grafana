import { lastValueFrom } from 'rxjs';

import {
  AdHocVariableFilter,
  GetTagResponse,
  MetricFindValue,
  RawTimeRange,
  Scope,
  scopeFilterOperatorMap,
  ScopeSpecFilter,
  urlUtil,
} from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus';
import { config, FetchResponse, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  ConstantVariable,
  CustomVariable,
  sceneGraph,
  SceneObject,
  SceneObjectState,
  SceneObjectUrlValues,
  SceneTimeRange,
  sceneUtils,
  SceneVariable,
  SceneVariableState,
} from '@grafana/scenes';
import { getClosestScopesFacade } from 'app/features/scopes';

import { getDatasourceSrv } from '../plugins/datasource_srv';

import { DataTrail } from './DataTrail';
import { DataTrailSettings } from './DataTrailSettings';
import { MetricScene } from './MetricScene';
import { getTrailStore } from './TrailStore/TrailStore';
import { MetricDatasourceHelper } from './helpers/MetricDatasourceHelper';
import { sortResources } from './otel/util';
import { LOGS_METRIC, TRAILS_ROUTE, VAR_DATASOURCE_EXPR, VAR_OTEL_AND_METRIC_FILTERS } from './shared';

export function isAdHocVariable(variable: SceneVariable | null): variable is AdHocFiltersVariable {
  return variable !== null && variable.state.type === 'adhoc';
}

export function isCustomVariable(variable: SceneVariable | null): variable is CustomVariable {
  return variable !== null && variable.state.type === 'custom';
}

export function isConstantVariable(variable: SceneVariable | null): variable is ConstantVariable {
  return variable !== null && variable.state.type === 'constant';
}

export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

export function getTrailSettings(model: SceneObject): DataTrailSettings {
  return sceneGraph.getAncestor(model, DataTrail).state.settings;
}

export function newMetricsTrail(initialDS?: string, startButtonClicked?: boolean): DataTrail {
  return new DataTrail({
    initialDS,
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    embedded: false,
    startButtonClicked,
  });
}

export function getUrlForTrail(trail: DataTrail) {
  const params = sceneUtils.getUrlState(trail);
  return getUrlForValues(params);
}

export function getUrlForValues(values: SceneObjectUrlValues) {
  return urlUtil.renderUrl(TRAILS_ROUTE, values);
}

export function getMetricSceneFor(model: SceneObject): MetricScene {
  if (model instanceof MetricScene) {
    return model;
  }

  if (model.parent) {
    return getMetricSceneFor(model.parent);
  }

  console.error('Unable to find graph view for', model);

  throw new Error('Unable to find trail');
}

export function getDataSource(trail: DataTrail) {
  return sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
}

export function getDataSourceName(dataSourceUid: string) {
  return getDataSourceSrv().getInstanceSettings(dataSourceUid)?.name || dataSourceUid;
}

export function getMetricName(metric?: string) {
  if (!metric) {
    return 'All metrics';
  }

  if (metric === LOGS_METRIC) {
    return 'Logs';
  }

  return metric;
}

export function getDatasourceForNewTrail(): string | undefined {
  const prevTrail = getTrailStore().recent[0];
  if (prevTrail) {
    const prevDataSource = sceneGraph.interpolate(prevTrail.resolve(), VAR_DATASOURCE_EXPR);
    if (prevDataSource.length > 0) {
      return prevDataSource;
    }
  }
  const promDatasources = getDatasourceSrv().getList({ type: 'prometheus' });
  if (promDatasources.length > 0) {
    const defaultDatasource = promDatasources.find((mds) => mds.isDefault);

    return defaultDatasource?.uid ?? promDatasources[0].uid;
  }
  return undefined;
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

export type SceneTimeRangeState = SceneObjectState & {
  from: string;
  to: string;
  timeZone?: string;
};

export function isSceneTimeRangeState(state: SceneObjectState): state is SceneTimeRangeState {
  const keys = Object.keys(state);
  return keys.includes('from') && keys.includes('to');
}

export function getFilters(scene: SceneObject) {
  const filters = sceneGraph.lookupVariable('filters', scene);
  if (filters instanceof AdHocFiltersVariable) {
    return filters.state.filters;
  }
  return null;
}

// frontend hardening limit
const MAX_ADHOC_VARIABLE_OPTIONS = 10000;

/**
 * Add custom providers for the adhoc filters variable that limit the responses for labels keys and label values.
 * Currently hard coded to 10000.
 *
 * The current provider functions for adhoc filter variables are the functions getTagKeys and getTagValues in the data source.
 * This function still uses these functions from inside the data source helper.
 *
 * @param dataTrail
 * @param limitedFilterVariable Depending on otel experience flag, either filtersVar or otelAndMetricsVar
 * @param datasourceHelper
 */
export function limitAdhocProviders(
  dataTrail: DataTrail,
  limitedFilterVariable: SceneVariable<SceneVariableState> | null,
  datasourceHelper: MetricDatasourceHelper
) {
  if (!(limitedFilterVariable instanceof AdHocFiltersVariable)) {
    return;
  }

  limitedFilterVariable.setState({
    getTagKeysProvider: async (
      variable: AdHocFiltersVariable,
      currentKey: string | null
    ): Promise<{
      replace?: boolean;
      values: GetTagResponse | MetricFindValue[];
    }> => {
      // For the Prometheus label names endpoint, '/api/v1/labels'
      // get the previously selected filters from the variable
      // to use in the query to filter the response
      // using filters, e.g. {previously_selected_label:"value"},
      // as the series match[] parameter in Prometheus labels endpoint
      const filters = limitedFilterVariable.state.filters;
      // call getTagKeys and truncate the response
      // we're passing the queries so we get the labels that adhere to the queries
      // we're also passing the scopes so we get the labels that adhere to the scopes filters

      const opts = {
        filters,
        scopes: getClosestScopesFacade(variable)?.value,
        queries: dataTrail.getQueries(),
      };

      // if there are too many queries it takes to much time to process the requests.
      // In this case we favour responsiveness over reducing the number of options.
      if (opts.queries.length > 20) {
        opts.queries = [];
      }

      let values = (await datasourceHelper.getTagKeys(opts)).slice(0, MAX_ADHOC_VARIABLE_OPTIONS);

      // sort the values for otel resources at the top
      if (limitedFilterVariable.state.name === VAR_OTEL_AND_METRIC_FILTERS) {
        values = sortResources(
          values,
          filters.map((f) => f.key)
        );
      }
      // use replace: true to override the default lookup in adhoc filter variable
      return { replace: true, values };
    },
    getTagValuesProvider: async (
      variable: AdHocFiltersVariable,
      filter: AdHocVariableFilter
    ): Promise<{
      replace?: boolean;
      values: GetTagResponse | MetricFindValue[];
    }> => {
      // For the Prometheus label values endpoint, /api/v1/label/${interpolatedName}/values
      // get the previously selected filters from the variable
      // to use in the query to filter the response
      // using filters, e.g. {previously_selected_label:"value"},
      // as the series match[] parameter in Prometheus label values endpoint
      const filtersValues = limitedFilterVariable.state.filters;
      // remove current selected filter if updating a chosen filter
      const filters = filtersValues.filter((f) => f.key !== filter.key);
      // call getTagValues and truncate the response
      // we're passing the queries so we get the label values that adhere to the queries
      // we're also passing the scopes so we get the label values that adhere to the scopes filters

      const opts = {
        key: filter.key,
        filters,
        scopes: getClosestScopesFacade(variable)?.value,
        queries: dataTrail.getQueries(),
      };

      // if there are too many queries it takes to much time to process the requests.
      // In this case we favour responsiveness over reducing the number of options.
      if (opts.queries.length > 20) {
        opts.queries = [];
      }

      const values = (await datasourceHelper.getTagValues(opts)).slice(0, MAX_ADHOC_VARIABLE_OPTIONS);
      // use replace: true to override the default lookup in adhoc filter variable
      return { replace: true, values };
    },
  });
}

export type SuggestionsResponse = {
  data: string[];
  status: 'success' | 'error';
  error?: 'string';
  warnings?: string[];
};

// Suggestions API is an API that receives adhoc filters, scopes and queries and returns the labels or label values that match the provided parameters
// Under the hood it does exactly what the label and label values API where doing but the processing is done in the BE rather than in the FE
export async function callSuggestionsApi(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[],
  adHocVariableFilters: AdHocVariableFilter[],
  labelName: string | undefined,
  limit: number | undefined,
  requestId: string
): Promise<FetchResponse<SuggestionsResponse>> {
  return await lastValueFrom(
    getBackendSrv().fetch<SuggestionsResponse>({
      url: `/api/datasources/uid/${dataSourceUid}/resources/suggestions`,
      data: {
        labelName,
        queries: [],
        scopes: scopes.reduce<ScopeSpecFilter[]>((acc, scope) => {
          acc.push(...scope.spec.filters);

          return acc;
        }, []),
        adhocFilters: adHocVariableFilters.map((filter) => ({
          key: filter.key,
          operator: scopeFilterOperatorMap[filter.operator],
          value: filter.value,
          values: filter.values,
        })),
        start: getPrometheusTime(timeRange.from, false).toString(),
        end: getPrometheusTime(timeRange.to, true).toString(),
        limit,
      },
      requestId,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  );
}
