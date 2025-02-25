import { RawTimeRange, Scope } from '@grafana/data';
import { getPrometheusTime, isValidLegacyName } from '@grafana/prometheus';
import { config, getBackendSrv } from '@grafana/runtime';

import { callSuggestionsApi } from '../utils';

import { OtelResponse, LabelResponse, OtelTargetType } from './types';
import { limitOtelMatchTerms, sortResources } from './util';

const OTEL_RESOURCE_EXCLUDED_FILTERS = ['__name__']; // name is handled by metric search metrics bar
/**
 * Function used to test for OTEL
 * When filters are added, we can also get a list of otel targets used to reduce the metric list
 * */
const otelTargetInfoQuery = (filters?: string) => `count(target_info{${filters ?? ''}}) by (job, instance)`;
const metricOtelJobInstanceQuery = (metric: string) => `count(${metric}) by (job, instance)`;

export const TARGET_INFO_FILTER = { key: '__name__', value: 'target_info', operator: '=' };

/**
 * Get the total amount of job/instance for target_info or for a metric.
 *
 * If used for target_info, this is the metric preview scene with many panels and
 * the job/instance pairs will be used to filter the metric list.
 *
 * If used for a metric, this is the metric preview scene with a single panel and
 * the job/instance pairs will be used to identify otel resource attributes for the metric
 * and distinguish between resource attributes and promoted attributes.
 *
 * @param dataSourceUid
 * @param timeRange
 * @param filters
 * @returns
 */
export async function totalOtelResources(
  dataSourceUid: string,
  timeRange: RawTimeRange,
  filters?: string,
  metric?: string
): Promise<OtelTargetType> {
  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);
  // check that the metric is utf8 before doing a resource query
  if (metric && !isValidLegacyName(metric)) {
    metric = `{"${metric}"}`;
  }
  const query = metric ? metricOtelJobInstanceQuery(metric) : otelTargetInfoQuery(filters);

  const url = `/api/datasources/uid/${dataSourceUid}/resources/api/v1/query`;
  const paramsTotalTargets: Record<string, string | number> = {
    start,
    end,
    query,
  };

  const responseTotal = await getBackendSrv().get<OtelResponse>(
    url,
    paramsTotalTargets,
    `metrics-drilldown-otel-check-total-${query}`
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

  return {
    jobs,
    instances,
  };
}

/**
 * Query the DS for deployment environment label values.
 * The deployment environment can be either on target_info or promoted to metrics.
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
    // we are ok if deployment_environment has been promoted to metrics so we don't need the match
    // 'match[]': '{__name__="target_info"}',
  };

  const response = await getBackendSrv().get<LabelResponse>(
    url,
    params,
    'metrics-drilldown-otel-resources-deployment-env'
  );

  // exclude __name__ or previously chosen filters
  return response.data;
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
      // we are ok if deployment_environment has been promoted to metrics so we don't need the match
      // 'match[]': '{__name__="target_info"}',
      // {
      //   key: '__name__',
      //   operator: '=',
      //   value: 'target_info',
      // },
    ],
    'deployment_environment',
    undefined,
    'metrics-drilldown-otel-resources-deployment-env'
  );
  // exclude __name__ or previously chosen filters
  return response.data.data;
}

/**
 * For OTel, get the resource attributes for a metric.
 * Handle filtering on both OTel resources as well as metric labels.
 *
 * 1. Does not include resources promoted to metrics
 * 2. Does not include __name__ or previously chosen filters
 * 3. Sorts the resources, surfacing the blessedlist on top
 * 4. Identifies if missing targets if the job/instance list is too long for the label values endpoint request
 *
 * @param datasourceUid
 * @param timeRange
 * @param metric
 * @param excludedFilters
 * @returns attributes: string[], missingOtelTargets: boolean
 */
export async function getFilteredResourceAttributes(
  datasourceUid: string,
  timeRange: RawTimeRange,
  metric: string,
  excludedFilters?: string[]
) {
  // These filters should not be included in the resource attributes for users to choose from
  const allExcludedFilters = (excludedFilters ?? []).concat(OTEL_RESOURCE_EXCLUDED_FILTERS);

  // The jobs and instances for the metric
  const metricResources = await totalOtelResources(datasourceUid, timeRange, undefined, metric);

  // OTel metrics require unique identifies for the resource. Job+instance is the unique identifier.
  // If there are none, we cannot join on a target_info resource
  if (metricResources.jobs.length === 0 || metricResources.instances.length === 0) {
    return { attributes: [], missingOtelTargets: false };
  }

  // The URL for the labels endpoint
  const url = `/api/datasources/uid/${datasourceUid}/resources/api/v1/labels`;

  // The match param for the metric to get all possible labels for this metric
  const metricMatchTerms = limitOtelMatchTerms([], metricResources.jobs, metricResources.instances);

  let metricMatchParam = '';
  // check metric is utf8 to give corrrect syntax
  if (!isValidLegacyName(metric)) {
    metricMatchParam = `{'${metric}',${metricMatchTerms.jobsRegex},${metricMatchTerms.instancesRegex}}`;
  } else {
    metricMatchParam = `${metric}{${metricMatchTerms.jobsRegex},${metricMatchTerms.instancesRegex}}`;
  }

  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);

  const metricParams: Record<string, string | number> = {
    start,
    end,
    'match[]': metricMatchParam,
  };

  // We prioritize metric attributes over resource attributes.
  // If a label is present in both metric and target_info, we exclude it from the resource attributes.
  // This prevents errors in the join query.
  const metricResponse = await getBackendSrv().get<LabelResponse>(
    url,
    metricParams,
    `metrics-drilldown-otel-resources-metric-job-instance-${metricMatchParam}`
  );
  // the metric labels here
  const metricLabels = metricResponse.data ?? [];

  // only get the resource attributes filtered by job and instance values present on the metric
  let targetInfoMatchParam = `target_info{${metricMatchTerms.jobsRegex},${metricMatchTerms.instancesRegex}}`;

  const targetInfoParams: Record<string, string | number> = {
    start,
    end,
    'match[]': targetInfoMatchParam,
  };

  // these are the resource attributes that come from target_info,
  // filtered by the metric job and instance
  const targetInfoResponse = await getBackendSrv().get<LabelResponse>(
    url,
    targetInfoParams,
    `metrics-drilldown-otel-resources-metric-job-instance-${targetInfoMatchParam}`
  );

  const targetInfoAttributes = targetInfoResponse.data ?? [];

  // first filters out metric labels from the resource attributes
  const firstFilter = targetInfoAttributes.filter((resource) => !metricLabels.includes(resource));

  // exclude __name__ or previously chosen filters
  const secondFilter = firstFilter
    .filter((resource) => !allExcludedFilters.includes(resource))
    .map((el) => ({ text: el }));

  // sort the resources, surfacing the blessedlist on top
  let sortedResourceAttributes = sortResources(secondFilter, ['job']);
  // return a string array
  const resourceAttributes = sortedResourceAttributes.map((el) => el.text);

  return { attributes: resourceAttributes, missingOtelTargets: metricMatchTerms.missingOtelTargets };
}

/**
 * This function gets otel resources that only exist in target_info and
 * do not exist on metrics as promoted labels.
 *
 * This is used when selecting a label from the list that includes both otel resources and metric labels.
 * This list helps identify that a selected lbel/resource must be stored in VAR_OTEL_RESOURCES or VAR_FILTERS to be interpolated correctly in the queries.
 */
export async function getNonPromotedOtelResources(datasourceUid: string, timeRange: RawTimeRange) {
  const start = getPrometheusTime(timeRange.from, false);
  const end = getPrometheusTime(timeRange.to, true);
  // The URL for the labels endpoint
  const url = `/api/datasources/uid/${datasourceUid}/resources/api/v1/labels`;
  // GET TARGET_INFO LABELS
  const targetInfoParams: Record<string, string | number> = {
    start,
    end,
    'match[]': `{__name__="target_info"}`,
  };

  // these are the resource attributes that come from target_info,
  // filtered by the metric job and instance
  const targetInfoResponse = getBackendSrv().get<LabelResponse>(
    url,
    targetInfoParams,
    `metrics-drilldown-all-otel-resources-on-target_info`
  );

  // all labels in all metrics
  const metricParams: Record<string, string | number> = {
    start,
    end,
    'match[]': `{name!="",__name__!~"target_info"}`,
  };

  // Get the metric labels but exclude any labels found on target_info.
  // We prioritize metric attributes over resource attributes.
  // If a label is present in both metric and target_info, we exclude it from the resource attributes.
  // This prevents errors in the join query.
  const metricResponse = await getBackendSrv().get<LabelResponse>(
    url,
    metricParams,
    `metrics-drilldown-all-metric-labels-not-otel-resource-attributes`
  );
  const promResponses = await Promise.all([targetInfoResponse, metricResponse]);
  // otel resource attributes
  const targetInfoLabels = promResponses[0].data ?? [];
  // the metric labels here
  const metricLabels = new Set(promResponses[1].data ?? []);

  // get all the resource attributes that are not present on metrics (have been promoted to metrics)
  const nonPromotedResources = targetInfoLabels.filter((item) => !metricLabels.has(item));

  return nonPromotedResources;
}
