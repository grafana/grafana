import { AdHocVariableFilter, UrlQueryValue, UrlQueryMap } from '@grafana/data';
import { sceneGraph, AdHocFiltersVariable } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { VAR_OTEL_AND_METRIC_FILTERS } from '../shared';

// var-deployment_environment
// var-otel_resources
// http://localhost:3000/extra/explore/metrics/trail?metric=asserts:kpi:latency:total:rate5m&from=now-1h&to=now&timezone=browser&var-ds=edwxqcebl0cg0c&var-deployment_environment=oteldemo01&var-otel_resources=&var-filters=&actionView=overview&var-groupby=$__all
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
  if (urlParams['var-otel_and_metric_filters']) {
    return;
  }
  // no dep env, does not need to be migrated
  if (!deploymentEnv) {
    return;
  }

  let filters: AdHocVariableFilter[] = [];
  // if there is a dep environment, we must also migrate the otel resources to the new variable
  const otelResources = urlParams['var-otel_resources'];
  const metricVarfilters = urlParams['var-filters'];
  // both of these must be arrays
  if (
    typeof deploymentEnv === 'object' &&
    deploymentEnv.length > 0 &&
    deploymentEnv[0] !== '' &&
    deploymentEnv.every((r) => r && typeof r === 'string')
  ) {
    // all the values are strings because they are prometheus labels
    // so we can safely cast them to strings
    const stringDepEnv = deploymentEnv.map((r) => r.toString());
    const depEnvVals = reduceDepEnv(stringDepEnv);

    filters = [
      {
        key: 'deployment_environment',
        operator: deploymentEnv.length > 1 ? '=~' : '=',
        value: depEnvVals,
      },
    ];
  }

  const otelFilters = migrateAdHocFilters(otelResources);
  const metricFilters = migrateAdHocFilters(metricVarfilters);

  filters = [...filters, ...otelFilters, ...metricFilters];

  const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);

  if (!(otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable)) {
    return;
  }

  otelAndMetricsFiltersVariable?.setState({
    filters,
  });
}

export function migrateAdHocFilters(urlFilter: UrlQueryValue) {
  if (
    !(
      urlFilter && // is present
      typeof urlFilter === 'object' && // is an array
      urlFilter.length > 0 && // has values
      urlFilter[0] !== '' && // empty vars can contain ''
      urlFilter.every((r) => r && typeof r === 'string') // vars are of any type but ours are all strings
    )
  ) {
    return [];
  }

  let filters: AdHocVariableFilter[] = [];

  filters = urlFilter.map((filter) => {
    const parts = filter.toString().split('|');
    return {
      key: parts[0].toString(),
      operator: parts[1].toString(),
      value: parts[2].toString(),
    };
  });

  return filters;
}

function reduceDepEnv(depEnv: string[]) {
  return depEnv.reduce((acc: string, env: string, idx: number) => {
    if (idx === 0) {
      return env;
    }

    return `${acc}|${env}`;
  }, '');
}
