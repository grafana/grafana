import { MetricFindValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AdHocFiltersVariable, ConstantVariable, CustomVariable, sceneGraph, SceneObject } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import {
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
  VAR_MISSING_OTEL_TARGETS,
  VAR_OTEL_DEPLOYMENT_ENV,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from '../shared';

import { getFilteredResourceAttributes } from './api';
import { OtelResourcesObject } from './types';

export const blessedList = (): Record<string, number> => {
  return {
    cloud_availability_zone: 0,
    cloud_region: 0,
    container_name: 0,
    k8s_cluster_name: 0,
    k8s_container_name: 0,
    k8s_cronjob_name: 0,
    k8s_daemonset_name: 0,
    k8s_deployment_name: 0,
    k8s_job_name: 0,
    k8s_namespace_name: 0,
    k8s_pod_name: 0,
    k8s_replicaset_name: 0,
    k8s_statefulset_name: 0,
    service_instance_id: 0,
    service_name: 0,
    service_namespace: 0,
  };
};

export function sortResources(resources: MetricFindValue[], excluded: string[]) {
  // these may be filtered
  const promotedList = blessedList();

  const blessed = Object.keys(promotedList);

  resources = resources.filter((resource) => {
    // if not in the list keep it
    const val = (resource.value ?? '').toString();

    if (!blessed.includes(val)) {
      return true;
    }
    // remove blessed filters
    // but indicate which are available
    promotedList[val] = 1;
    return false;
  });

  const promotedResources = Object.keys(promotedList)
    .filter((resource) => promotedList[resource] && !excluded.includes(resource))
    .map((v) => ({ text: v }));

  // put the filters first
  return promotedResources.concat(resources);
}

/**
 * Return a collection of labels and labels filters.
 * This data is used to build the join query to filter with otel resources
 *
 * @param otelResourcesObject
 * @returns a string that is used to add a join query to filter otel resources
 */
export function getOtelJoinQuery(otelResourcesObject: OtelResourcesObject, scene?: SceneObject): string {
  // the group left is for when a user wants to breakdown by a resource attribute
  let groupLeft = '';

  if (scene) {
    const value = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, scene)?.getValue();
    groupLeft = typeof value === 'string' ? value : '';
  }

  let otelResourcesJoinQuery = '';
  if (otelResourcesObject.filters && otelResourcesObject.labels) {
    // add support for otel data sources that are not standardized, i.e., have non unique target_info series by job, instance
    otelResourcesJoinQuery = `* on (job, instance) group_left(${groupLeft}) topk by (job, instance) (1, target_info{${otelResourcesObject.filters}})`;
  }

  return otelResourcesJoinQuery;
}

/**
 * Returns an object containing all the filters for otel resources as well as a list of labels
 *
 * @param scene
 * @param firstQueryVal
 * @returns
 */
export function getOtelResourcesObject(scene: SceneObject, firstQueryVal?: string): OtelResourcesObject {
  const otelResources = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, scene);
  // add deployment env to otel resource filters
  const otelDepEnv = sceneGraph.lookupVariable(VAR_OTEL_DEPLOYMENT_ENV, scene);

  let otelResourcesObject = { labels: '', filters: '' };

  if (otelResources instanceof AdHocFiltersVariable && otelDepEnv instanceof CustomVariable) {
    // get the collection of adhoc filters
    const otelFilters = otelResources.state.filters;

    // get the value for deployment_environment variable
    let otelDepEnvValue = String(otelDepEnv.getValue());
    // check if there are multiple environments
    const isMulti = otelDepEnvValue.includes(',');
    // start with the default label filters for deployment_environment
    let op = '=';
    let val = firstQueryVal ? firstQueryVal : otelDepEnvValue;
    // update the filters if multiple deployment environments selected
    if (isMulti) {
      op = '=~';
      val = val.split(',').join('|');
    }

    // start with the deployment environment
    let allFilters = `deployment_environment${op}"${val}"`;
    if (config.featureToggles.prometheusSpecialCharsInLabelValues) {
      allFilters = `deployment_environment${op}'${val}'`;
    }
    let allLabels = 'deployment_environment';

    // add the other OTEL resource filters
    for (let i = 0; i < otelFilters?.length; i++) {
      const labelName = otelFilters[i].key;
      const op = otelFilters[i].operator;
      const labelValue = otelFilters[i].value;

      if (config.featureToggles.prometheusSpecialCharsInLabelValues) {
        allFilters += `,${labelName}${op}'${labelValue}'`;
      } else {
        allFilters += `,${labelName}${op}"${labelValue}"`;
      }

      const addLabelToGroupLeft = labelName !== 'job' && labelName !== 'instance';

      if (addLabelToGroupLeft) {
        allLabels += `,${labelName}`;
      }
    }

    otelResourcesObject.labels = allLabels;
    otelResourcesObject.filters = allFilters;

    return otelResourcesObject;
  }
  return otelResourcesObject;
}

/**
 * This function checks that when adding OTel job and instance filters
 * to the label values request for a list of metrics,
 * the total character count of the request does not exceed 2000 characters
 *
 * @param matchTerms __name__ and other Prom filters
 * @param jobsList list of jobs in target_info
 * @param instancesList list of instances in target_info
 * @returns
 */
export function limitOtelMatchTerms(
  matchTerms: string[],
  jobsList: string[],
  instancesList: string[]
): { missingOtelTargets: boolean; jobsRegex: string; instancesRegex: string } {
  let missingOtelTargets = false;
  const charLimit = 2000;

  let initialCharAmount = matchTerms.join(',').length;

  // start to add values to the regex and start quote
  let jobsRegex = `job=~'`;
  let instancesRegex = `instance=~'`;

  // iterate through the jobs and instances,
  // count the chars as they are added,
  // stop before the total count reaches 2000
  // show a warning that there are missing OTel targets and
  // the user must select more OTel resource attributes
  const jobCheck: { [key: string]: boolean } = {};
  const instanceCheck: { [key: string]: boolean } = {};
  for (let i = 0; i < jobsList.length; i++) {
    // use or character for the count
    const orChars = i === 0 ? 0 : 2;
    // count all the characters that will go into the match terms
    const checkCharAmount =
      initialCharAmount +
      jobsRegex.length +
      jobsList[i].length +
      instancesRegex.length +
      instancesList[i].length +
      orChars;

    if (checkCharAmount <= charLimit) {
      if (i === 0) {
        jobsRegex += `${jobsList[i]}`;
        instancesRegex += `${instancesList[i]}`;
      } else {
        // check to make sure we aren't duplicating job or instance
        jobsRegex += jobCheck[jobsList[i]] ? '' : `|${jobsList[i]}`;
        instancesRegex += instanceCheck[instancesList[i]] ? '' : `|${instancesList[i]}`;
      }
      jobCheck[jobsList[i]] = true;
      instanceCheck[instancesList[i]] = true;
    } else {
      missingOtelTargets = true;
      break;
    }
  }
  // complete the quote after values have been added
  jobsRegex += `'`;
  instancesRegex += `'`;

  return {
    missingOtelTargets,
    jobsRegex,
    instancesRegex,
  };
}

/**
 * This updates the OTel join query variable that is interpolated into all queries.
 * When a user is in the breakdown or overview tab, they may want to breakdown a metric by a resource attribute.
 * The only way to do this is by enriching the metric with the target_info resource.
 * This is done by joining on a unique identifier for the resource, job and instance.
 * The we can get the resource attributes for the metric, enrich the metric with the join query and
 * show panels by aggregate functions over attributes.
 * E.g. sum(metric * on (job, instance) group_left(cloud_region) topk by (job, instance) (1, target_info{})) by cloud_region
 * where cloud_region is a resource attribute but not on the metric.
 * BUT if the attribute is on the metric already, we shouldn't add it to the group left.
 *
 * @param trail
 * @param metric
 * @returns
 */
export async function updateOtelJoinWithGroupLeft(trail: DataTrail, metric: string) {
  // When to remove or add the group left
  // REMOVE
  // - selecting a new metric and returning to metric select scene
  // ADD
  // - the metric is selected from previews
  // - the metric is loaded from refresh in metric scene
  // - the metric is loaded from bookmark
  const timeRange = trail.state.$timeRange?.state;
  if (!timeRange) {
    return;
  }
  const otelGroupLeft = sceneGraph.lookupVariable(VAR_OTEL_GROUP_LEFT, trail);
  const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
  const missingOtelTargetsVariable = sceneGraph.lookupVariable(VAR_MISSING_OTEL_TARGETS, trail);
  if (
    !(otelGroupLeft instanceof ConstantVariable) ||
    !(otelJoinQueryVariable instanceof ConstantVariable) ||
    !(missingOtelTargetsVariable instanceof ConstantVariable)
  ) {
    return;
  }
  // Remove the group left
  if (!metric) {
    // if the metric is not present, that means we are in the metric select scene
    // and that should have no group left because it may interfere with queries.
    otelGroupLeft.setState({ value: '' });
    const resourceObject = getOtelResourcesObject(trail);
    const otelJoinQuery = getOtelJoinQuery(resourceObject, trail);
    otelJoinQueryVariable.setState({ value: otelJoinQuery });
    return;
  }
  // if the metric is target_info, it already has all resource attributes
  if (metric === 'target_info') {
    return;
  }

  // Add the group left
  const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, trail);
  const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
  let excludeFilterKeys: string[] = [];
  if (filtersVariable instanceof AdHocFiltersVariable && otelResourcesVariable instanceof AdHocFiltersVariable) {
    // do not include the following
    // 1. pre selected label filters
    // 2. pre selected otel resource attribute filters
    // 3. job and instance labels (will break the join)
    const filterKeys = filtersVariable.state.filters.map((f) => f.key);
    const otelKeys = otelResourcesVariable.state.filters.map((f) => f.key);
    excludeFilterKeys = filterKeys.concat(otelKeys);
    excludeFilterKeys = excludeFilterKeys.concat(['job', 'instance']);
  }
  const datasourceUid = sceneGraph.interpolate(trail, VAR_DATASOURCE_EXPR);
  const { attributes, missingOtelTargets } = await getFilteredResourceAttributes(
    datasourceUid,
    timeRange,
    metric,
    excludeFilterKeys
  );
  // here we start to add the attributes to the group left
  if (attributes.length > 0) {
    // update the group left variable that contains all the filtered resource attributes
    otelGroupLeft.setState({ value: attributes.join(',') });
    // get the new otel join query that includes the group left attributes
    const resourceObject = getOtelResourcesObject(trail);
    const otelJoinQuery = getOtelJoinQuery(resourceObject, trail);
    // update the join query that is interpolated in all queries
    otelJoinQueryVariable.setState({ value: otelJoinQuery });
  }
  // used to show a warning in label breakdown that the user must select more OTel resource attributes
  missingOtelTargetsVariable.setState({ value: missingOtelTargets });
}

/**
 * Returns the option value that is like 'prod'.
 * If there are no options, returns null.
 *
 * @param options
 * @returns
 */
export function getProdOrDefaultOption(options: Array<{ value: string; label: string }>): string | null {
  if (options.length === 0) {
    return null;
  }

  return options.find((option) => option.value.toLowerCase().indexOf('prod') > -1)?.value ?? options[0].value;
}
