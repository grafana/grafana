import { AdHocVariableFilter, UrlQueryValue, UrlQueryMap } from '@grafana/data';
import { sceneGraph, AdHocFiltersVariable, CustomVariable } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { reportExploreMetrics } from '../interactions';
import { VAR_OTEL_AND_METRIC_FILTERS, VAR_OTEL_DEPLOYMENT_ENV } from '../shared';

/**
 * Migration for the otel deployment environment variable.
 * When the deployment environment is present in the url, "var-deployment_environment",
 * it is migrated to the new variable "var-otel_and_metric_filters."
 *
 * We check if the otel resources vars are also present in the url, "var-otel_resources"
 * and if the metric filters are present in the url, "var-filters".
 *
 * Once all the variables are migrated to "var-otel_and_metric_filters", the rest is handled in trail.updateOtelData.
 *
 * @param trail
 * @returns
 */
export function migrateOtelDeploymentEnvironment(trail: DataTrail, urlParams: UrlQueryMap) {
  const deploymentEnv = urlParams['var-deployment_environment'];
  // does not need to be migrated
  const otelMetricsVar = urlParams['var-otel_and_metric_filters'];

  // this check is if it has already been migrated
  if (
    otelMetricsVar &&
    Array.isArray(otelMetricsVar) &&
    otelMetricsVar.length > 0 &&
    (trail.state.startButtonClicked || otelMetricsVar[0] !== '')
  ) {
    return;
  }

  // check that there is a deployment environment variable value to migrate
  // in some cases the deployment environment may not present
  // but due to this change it is now always present and the value is undefined
  // https://github.com/grafana/scenes/pull/1033
  if (
    !deploymentEnv ||
    (Array.isArray(deploymentEnv) && deploymentEnv.length > 0 && deploymentEnv[0] === 'undefined')
  ) {
    return;
  }

  let filters: AdHocVariableFilter[] = [];
  // if there is a deployment environment, we must also migrate the otel resources to the new variable
  const otelResources = urlParams['var-otel_resources'];
  const metricVarfilters = urlParams['var-filters'];
  if (
    Array.isArray(deploymentEnv) &&
    deploymentEnv.length > 0 &&
    deploymentEnv[0] !== '' &&
    deploymentEnv.every((r) => r && typeof r === 'string')
  ) {
    // all the values are strings because they are prometheus labels
    // so we can safely cast them to strings
    const stringDepEnv = deploymentEnv.map((r) => r.toString());
    const value = stringDepEnv.join('|');

    filters.push({
      key: 'deployment_environment',
      operator: deploymentEnv.length > 1 ? '=~' : '=',
      value,
    });
  }

  // mutate the filters and add to them if we need to
  migrateAdHocFilters(otelResources, filters);
  migrateAdHocFilters(metricVarfilters, filters);

  const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
  const deploymentEnvironmentVariable = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, trail);

  if (
    !(
      otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable &&
      deploymentEnvironmentVariable instanceof CustomVariable
    )
  ) {
    return;
  }

  otelAndMetricsFiltersVariable.setState({
    filters,
  });
  // clear the deployment environment to not migrate it again
  reportExploreMetrics('deployment_environment_migrated', {});
  deploymentEnvironmentVariable.setState({
    value: '',
  });
}

export function migrateAdHocFilters(urlFilter: UrlQueryValue, filters: AdHocVariableFilter[]) {
  if (
    !(
      urlFilter && // is present
      Array.isArray(urlFilter) && // is an array
      urlFilter.length > 0 && // has values
      urlFilter[0] !== '' && // empty vars can contain ''
      urlFilter.every((r) => r && typeof r === 'string') // vars are of any type but ours are all strings
    )
  ) {
    return filters;
  }

  urlFilter.forEach((filter) => {
    const parts = filter.toString().split('|');
    filters.push({
      key: parts[0].toString(),
      operator: parts[1].toString(),
      value: parts[2].toString(),
    });
  });

  return filters;
}
