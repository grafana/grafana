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
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { config, FetchResponse, getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
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
import { LOGS_METRIC, TRAILS_ROUTE, VAR_DATASOURCE_EXPR } from './shared';

export function getTrailFor(model: SceneObject): DataTrail {
  return sceneGraph.getAncestor(model, DataTrail);
}

export function getTrailSettings(model: SceneObject): DataTrailSettings {
  return sceneGraph.getAncestor(model, DataTrail).state.settings;
}

export function newMetricsTrail(initialDS?: string): DataTrail {
  return new DataTrail({
    initialDS,
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    embedded: false,
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
 * @param filtersVariable
 * @param datasourceHelper
 */
export function limitAdhocProviders(
  dataTrail: DataTrail,
  filtersVariable: SceneVariable<SceneVariableState> | null,
  datasourceHelper: MetricDatasourceHelper,
  useOtelExperience?: boolean,
) {
  if (!(filtersVariable instanceof AdHocFiltersVariable)) {
    return;
  }

  filtersVariable.setState({
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
      const filters = filtersVariable.state.filters;
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
      // use replace: true to override the default lookup in adhoc filter variable

      if (useOtelExperience) {
        // sort the values for showing otel resources at the top
        values = sortResources(values, filters.map((f) => f.key));
      }

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
      const filtersValues = filtersVariable.state.filters;
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


/**
 * Consolidate OTel resources into label filters
 *  - hide the adhoc filter and hide the otel resource filter
 *  - create an new overlaping adhoc filter, super filter that includes all attributes, resource and metric
 *  - identify the difference when selecting an attribute
 *  - place the attribute in the appropriate filter so that the query is interpolated with the correct filter in the correct place
 *
 * 1. The adhoc filters will contain all the otel resources (happens by default because list contains target_info)
 *   [x] the filter list will sort otel resources to the top
 * 2. Hide the otel resources variable
 *   a. [x] remove the updates when it is changed
 * 3. When a filter is selected, we need to identify the following
 *   a. [x] an otel resource (on target_info)
 *   b. [x] It is not promoted as a label on metric
 *     - [x] How to identify otel resource? Add function to make a collection
 *     - [x] Do not need to identify excluded filters for this collection, they will be excluded by adhoc filter behavior
 *     - [x] call for list of target_info labels and list of labels minut target info
 *     - [x] find the otel resources that do not exist in the labels
 *     - these are the non promoted resources
 *     - [x] if it is a resource attribute, it should be stored as such so it can be filtered in the join
 *   d. [x] Add selected otel resources to the hidden variable
 *   e. [x] when a filter is changed, change the correct filter
 * 4. Remove special the deployment environment variable totally
 *   a. [x] automatically select deployment_environment OR environment if it exists
 *   b. [ ] everywhere that the deployment environment is used remove it
 *        - [ ] confirm removal of otel dep env in historyy
 *   c. if deployment environment is promoted, this is fine and we can support more otel data sources
 *   d. update definition of isStandard OTel and check for job and instance instead
 *      - we did not support those that did not have them on target_info before
 * 5. Migrate any variable url values to adhoc to show them in the new filter
 *   a. otel filter
 *   b. deployment environment
 *   c. var filters get placed in the new otel metric filter
 */
