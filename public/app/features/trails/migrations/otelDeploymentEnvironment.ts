import { urlUtil, AdHocVariableFilter } from "@grafana/data";
import { sceneGraph, AdHocFiltersVariable } from "@grafana/scenes";

import { DataTrail } from "../DataTrail";
import { VAR_OTEL_AND_METRIC_FILTERS } from "../shared";

// var-deployment_environment
// var-otel_resources
// http://localhost:3000/extra/explore/metrics/trail?metric=asserts:kpi:latency:total:rate5m&from=now-1h&to=now&timezone=browser&var-ds=edwxqcebl0cg0c&var-deployment_environment=oteldemo01&var-otel_resources=&var-filters=&actionView=overview&var-groupby=$__all
/**
 * Migration for the otel deployment environment variable.
 * When the deployment environment is present in the url, "var-deployment_environment",
 * it is migrated to the new variable "var-otel_and_metric_filters."
 * We check if the otel resources vars are also present in the url, "var-otel_resources" 
 * @param trail 
 * @returns 
 */
export function migrateOtelDeploymentEnvironment(trail: DataTrail) {
  
  const urlParams = urlUtil.getUrlSearchParams();
  const deploymentEnv = urlParams['var-deployment_environment'];
  // does not need to be migrated
  if (urlParams['var-otel_and_metric_filters']) {
    return;
  }
  // no dep env, does not need to be migrated
  if (!deploymentEnv) {
    return;
  }
  // if there is a dep environment, we must also migrate the otel resources to the new variable
  const otelResources = urlParams['var-otel_resources'];
  // both of these must be arrays
  if (
    (typeof deploymentEnv === 'object' && deploymentEnv.length > 0) &&
    (otelResources && typeof otelResources === 'object' && otelResources.length)
  ) {
  
    let otelFilters: AdHocVariableFilter[] = [];

    // adhoc filter values are typed as any, but these will always be strings.
    // to avoid the typescript error, we enforce they are strings
    if (otelResources[0] !== '' && otelResources.every((r) => r && typeof r === 'string' )) {
      otelFilters = otelResources.map((filter) => {
        const parts = filter.toString().split('|');
        return {
          key: parts[0].toString(),
          operator: parts[2].toString(),
          value: parts[1].toString(),
        };
      })
    }
    // check if dep env has multi values
    const filters = [
      {
        key: 'deployment_environment',
        value: deploymentEnv[0].toString(),
        operator: deploymentEnv[0].toString().includes(',') ? '=~' : '=',
      },
      ...otelFilters
    ];

    const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);

    if (!(otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable)) {
      return
    }

    otelAndMetricsFiltersVariable?.setState({
      filters
    });
  }
}
