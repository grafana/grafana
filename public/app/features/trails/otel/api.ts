import { RawTimeRange, Scope } from '@grafana/data';
import { getPrometheusTime } from '@grafana/prometheus/src/language_utils';
import { config, getBackendSrv } from '@grafana/runtime';

import { callSuggestionsApi } from '../utils';

import { OtelResponse, LabelResponse, OtelTargetType } from './types';

const OTEL_RESOURCE_EXCLUDED_FILTERS = ['__name__', 'deployment_environment']; // name is handled by metric search metrics bar
/**
 * Function used to test for OTEL
 * When filters are added, we can also get a list of otel targets used to reduce the metric list
 * */
const otelTargetInfoQuery = (filters?: string) => `count(target_info{${filters ?? ''}}) by (job, instance)`;

export const TARGET_INFO_FILTER = { key: '__name__', value: 'target_info', operator: '=' };

/**
 * Query the DS for target_info matching job and instance.
 * Parse the results to get label filters.
 * @param dataSourceUid
 * @param timeRange
 * @returns OtelResourcesType[], labels for the query result requesting matching job and instance on target_info metric
 */
export async function getOtelResources(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  excludedFilters?: string[],
  matchFilters?: string
): Promise<string[]> {
  const allExcludedFilters = (excludedFilters ?? []).concat(OTEL_RESOURCE_EXCLUDED_FILTERS);

  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/labels`;
  const params: Record<string, string | number> = {
    start,
    end,
    'match[]': `{__name__="target_info"${matchFilters ? `,${matchFilters}` : ''}}`,
  };

  const response = await getBackendSrv().get<LabelResponse>(url, params, 'explore-metrics-otel-resources');

  // exclude __name__ or deployment_environment or previously chosen filters
  const resources = response.data?.filter((resource) => !allExcludedFilters.includes(resource)).map((el: string) => el);

  return resources;
}

/**
 * Get the total amount of job/instance pairs on target info metric
 *
 * @param dataSourceUid
 * @param timeRange
 * @param expr
 * @returns
 */
export async function totalOtelResources(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  filters?: string
): Promise<OtelTargetType> {
  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`;
  const paramsTotalTargets: Record<string, string | number> = {
    start,
    end,
    query: otelTargetInfoQuery(filters),
  };

  const responseTotal = await getBackendSrv().get<OtelResponse>(
    url,
    paramsTotalTargets,
    'explore-metrics-otel-check-total'
  );

  let jobs: string[] = [];
  let instances: string[] = [];

  responseTotal.data.result.forEach((result) => {
    // NOTE: sometimes there are target_info series with
    // - both job and instance labels
    // - only job label
    // - only instance label
    // Here we make sure both of them are present
    // because we use this collection to filter metric names
    if (result.metric.job && result.metric.instance) {
      jobs.push(result.metric.job);
      instances.push(result.metric.instance);
    }
  });

  const otelTargets: OtelTargetType = {
    jobs,
    instances,
  };

  return otelTargets;
}

/**
 * Look for duplicated series in target_info metric by job and instance labels
 * If each job&instance combo is unique, the data source is otel standardized.
 * If there is a count by job&instance on target_info greater than one,
 * the data source is not standardized
 *
 * @param dataSourceUid
 * @param timeRange
 * @param expr
 * @returns
 */
export async function isOtelStandardization(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  expr?: string
): Promise<boolean> {
  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`;

  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const paramsTargets: Record<string, string | number> = {
    start,
    end,
    // any data source with duplicated series will have a count > 1
    query: `${otelTargetInfoQuery()} > 1`,
  };

  const response = await getBackendSrv().get<OtelResponse>(url, paramsTargets, 'explore-metrics-otel-check-standard');

  // the response should be not greater than zero if it is standard
  const checkStandard = !(response.data.result.length > 0);

  return checkStandard;
}

/**
 * Query the DS for deployment environment label values.
 *
 * @param dataSourceUid
 * @param timeRange
 * @param scopes
 * @returns string[], values for the deployment_environment label
 */
export async function getDeploymentEnvironments(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[]
): Promise<string[]> {
  if (!config.featureToggles.enableScopesInMetricsExplore) {
    return getDeploymentEnvironmentsWithoutScopes(dataSourceUid, timeRange);
  }

  return getDeploymentEnvironmentsWithScopes(dataSourceUid, timeRange, scopes);
}

/**
 * Query the DS for deployment environment label values.
 *
 * @param dataSourceUid
 * @param timeRange
 * @returns string[], values for the deployment_environment label
 */
export async function getDeploymentEnvironmentsWithoutScopes(
  dataSourceUid: string,
  timeRange: RawTimeRange
): Promise<string[]> {
  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/label/deployment_environment/values`;
  const params: Record<string, string | number> = {
    start,
    end,
    'match[]': '{__name__="target_info"}',
  };

  const response = await getBackendSrv().get<LabelResponse>(
    url,
    params,
    'explore-metrics-otel-resources-deployment-env'
  );

  // exclude __name__ or deployment_environment or previously chosen filters
  const resources = response.data;

  return resources;
}

/**
 * Query the DS for deployment environment label values.
 *
 * @param dataSourceUid
 * @param timeRange
 * @param scopes
 * @returns string[], values for the deployment_environment label
 */
export async function getDeploymentEnvironmentsWithScopes(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  scopes: Scope[]
): Promise<string[]> {
  const response = await callSuggestionsApi(
    dataSourceUid,
    timeRange,
    scopes,
    [
      {
        key: '__name__',
        operator: '=',
        value: 'target_info',
      },
    ],
    'deployment_environment',
    undefined,
    'explore-metrics-otel-resources-deployment-env'
  );
  // exclude __name__ or deployment_environment or previously chosen filters
  return response.data.data;
}
