import { AdHocVariableFilter, MetricFindValue, RawTimeRange, VariableHide } from '@grafana/data';
import { isValidLegacyName } from '@grafana/prometheus';
import { config } from '@grafana/runtime';
import { AdHocFiltersVariable, ConstantVariable, sceneGraph, SceneObject } from '@grafana/scenes';

import { DataTrail } from '../DataTrail';
import { reportChangeInLabelFilters } from '../interactions';
import { getOtelExperienceToggleState } from '../services/store';
import {
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
  VAR_MISSING_OTEL_TARGETS,
  VAR_OTEL_AND_METRIC_FILTERS,
  VAR_OTEL_GROUP_LEFT,
  VAR_OTEL_JOIN_QUERY,
  VAR_OTEL_RESOURCES,
} from '../shared';

import { getFilteredResourceAttributes, totalOtelResources } from './api';
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
  // add support for otel data sources that are not standardized, i.e., have non unique target_info series by job, instance
  // target_info does not have to be filtered by deployment environment
  otelResourcesJoinQuery = `* on (job, instance) group_left(${groupLeft}) topk by (job, instance) (1, target_info{${otelResourcesObject.filters}})`;

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
  let otelResourcesObject = { labels: '', filters: '' };

  if (otelResources instanceof AdHocFiltersVariable) {
    // get the collection of adhoc filters
    const otelFilters = otelResources.state.filters;

    let allFilters = '';
    let allLabels = '';

    // add the other OTEL resource filters
    for (let i = 0; i < otelFilters?.length; i++) {
      let labelName = otelFilters[i].key;

      // when adding an otel resource filter with utfb
      if (!isValidLegacyName(labelName)) {
        labelName = `'${labelName}'`;
      }

      const op = otelFilters[i].operator;
      const labelValue = otelFilters[i].value;

      if (i > 0) {
        allFilters += ',';
      }

      if (config.featureToggles.prometheusSpecialCharsInLabelValues) {
        allFilters += `${labelName}${op}'${labelValue}'`;
      } else {
        allFilters += `${labelName}${op}"${labelValue}"`;
      }

      const addLabelToGroupLeft = labelName !== 'job' && labelName !== 'instance';

      if (addLabelToGroupLeft) {
        allLabels += `${labelName}`;
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
 * When a user is in the breakdown tab, they may want to breakdown a metric by a resource attribute.
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
  // if the metric is target_info, it already has all resource attributes
  if (!metric || metric === 'target_info') {
    // if the metric is not present, that means we are in the metric select scene
    // and that should have no group left because it may interfere with queries.
    otelGroupLeft.setState({ value: '' });
    const resourceObject = getOtelResourcesObject(trail);
    const otelJoinQuery = getOtelJoinQuery(resourceObject, trail);
    otelJoinQueryVariable.setState({ value: otelJoinQuery });
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
    // loop through attributes to check for utf8
    const utf8Attributes = attributes.map((a) => {
      if (!isValidLegacyName(a)) {
        return `'${a}'`;
      }
      return a;
    });
    // update the group left variable that contains all the filtered resource attributes
    otelGroupLeft.setState({ value: utf8Attributes.join(',') });
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
 * Returns the environment that is like 'prod'.
 * If there are no options, returns null.
 *
 * @param options
 * @returns
 */
export function getProdOrDefaultEnv(envs: string[]): string | null {
  if (envs.length === 0) {
    return null;
  }

  return envs.find((env) => env.toLowerCase().indexOf('prod') > -1) ?? envs[0];
}

/**
 *  This function is used to update state and otel variables.
 *
 *  1. Set the otelResources adhoc tagKey and tagValues filter functions
 *  2. Get the otel join query for state and variable
 *  3. Update state with the following
 *    - otel join query
 *    - otelTargets used to filter metrics
 *  For initialization we also update the following
 *    - has otel resources flag
 *    - isStandardOtel flag (for enabliing the otel experience toggle)
 *    - and useOtelExperience
 *
 * This function is called on start and when variables change.
 * On start will provide the deploymentEnvironments and hasOtelResources parameters.
 * In the variable change case, we will not provide these parameters. It is assumed that the
 * data source has been checked for otel resources and standardization and the otel variables are enabled at this point.
 * @param datasourceUid
 * @param timeRange
 * @param deploymentEnvironments
 * @param hasOtelResources
 * @param nonPromotedOtelResources
 * @param fromDataSourceChanged
 */
export async function updateOtelData(
  trail: DataTrail,
  datasourceUid: string,
  timeRange: RawTimeRange,
  deploymentEnvironments?: string[],
  hasOtelResources?: boolean,
  nonPromotedOtelResources?: string[]
) {
  // currently need isUpdatingOtel check for variable race conditions and state changes
  // future refactor project
  //  - checkDataSourceForOTelResources for state changes
  //  - otel resources var for variable dependency listeners
  if (trail.state.isUpdatingOtel) {
    return;
  }
  trail.setState({ isUpdatingOtel: true });

  const otelResourcesVariable = sceneGraph.lookupVariable(VAR_OTEL_RESOURCES, trail);
  const filtersVariable = sceneGraph.lookupVariable(VAR_FILTERS, trail);
  const otelAndMetricsFiltersVariable = sceneGraph.lookupVariable(VAR_OTEL_AND_METRIC_FILTERS, trail);
  const otelJoinQueryVariable = sceneGraph.lookupVariable(VAR_OTEL_JOIN_QUERY, trail);
  const initialOtelCheckComplete = trail.state.initialOtelCheckComplete;
  const resettingOtel = trail.state.resettingOtel;

  if (
    !(
      otelResourcesVariable instanceof AdHocFiltersVariable &&
      filtersVariable instanceof AdHocFiltersVariable &&
      otelAndMetricsFiltersVariable instanceof AdHocFiltersVariable &&
      otelJoinQueryVariable instanceof ConstantVariable
    )
  ) {
    return;
  }
  // Set deployment environment variable as a new otel & metric filter.
  // We choose one default value at the beginning of the OTel experience.
  // This is because the work flow for OTel begins with users selecting a deployment environment
  // default to production.
  let defaultDepEnv = getProdOrDefaultEnv(deploymentEnvironments ?? []) ?? '';

  const isEnabledInLocalStorage = getOtelExperienceToggleState();

  // We respect that if users have it turned off in local storage we keep it off unless the toggle is switched
  if (!isEnabledInLocalStorage) {
    trail.resetOtelExperience(hasOtelResources, nonPromotedOtelResources);
  } else {
    // 1. Cases of how to add filters to the otelmetricsvar
    //  -- when we set these on instantiation, we need to check that we are not double setting them
    // 1.0. legacy, check url values for dep env and otel resources and migrate to otelmetricvar
    //  -- do not duplicate
    // 1.1. NONE If the otel metrics var has no filters, set the default value
    // 1.2. VAR_FILTERS If the var filters has filters, add to otemetricsvar
    //  -- do not duplicate when adding to otelmtricsvar
    // 1.3. OTEL_FILTERS If the otel resources var has filters, add to otelmetricsvar
    //  -- do not duplicate when adding to otelmtricsvar

    // 1. switching data source
    // the previous var filters are not reset so even if they don't apply to the new data source we want to keep them
    // 2. on load with url values, check isInitial CheckComplete
    // Set otelmetrics var, distinguish if these are var filters or otel resources, then place in correct filter
    let prevVarFilters = resettingOtel ? filtersVariable.state.filters : [];
    // only look at url values for otelmetricsvar if the initial check is NOT YET complete
    const urlOtelAndMetricsFilters =
      initialOtelCheckComplete && !resettingOtel ? [] : otelAndMetricsFiltersVariable.state.filters;
    // url vars should override the deployment environment variable
    const urlVarsObject = checkLabelPromotion(urlOtelAndMetricsFilters, nonPromotedOtelResources);
    const urlOtelResources = initialOtelCheckComplete ? [] : urlVarsObject.nonPromoted;
    const urlVarFilters = initialOtelCheckComplete ? [] : urlVarsObject.promoted;

    // set the vars if the following conditions
    if (!initialOtelCheckComplete || resettingOtel) {
      // if the default dep env value like 'prod' is missing OR
      // if we are loading from the url and the default dep env is missing
      // there are no prev deployment environments from url
      const hasPreviousDepEnv = urlOtelAndMetricsFilters.filter((f) => f.key === 'deployment_environment').length > 0;
      const doNotSetDepEvValue = defaultDepEnv === '' || hasPreviousDepEnv;
      // we do not have to set the dep env value if the default is missing
      const defaultDepEnvFilter = doNotSetDepEvValue
        ? []
        : [
            {
              key: 'deployment_environment',
              value: defaultDepEnv,
              operator: defaultDepEnv.includes(',') ? '=~' : '=',
            },
          ];

      const notPromoted = nonPromotedOtelResources?.includes('deployment_environment');
      // Next, the previous data source filters may include the default dep env but in the wrong filter
      // i.e., dep env is not promoted to metrics but in the previous DS, it was, so it will exist in the VAR FILTERS
      // and we will see a duplication in the OTELMETRICSVAR
      // remove the duplication
      prevVarFilters = notPromoted ? prevVarFilters.filter((f) => f.key !== 'deployment_environment') : prevVarFilters;

      // previous var filters are handled but what about previous otel resources filters?
      // need to add the prev otel resources to the otelmetricsvar filters
      otelAndMetricsFiltersVariable?.setState({
        filters: [...defaultDepEnvFilter, ...prevVarFilters, ...urlOtelAndMetricsFilters],
        hide: VariableHide.hideLabel,
      });

      // update the otel resources if the dep env has not been promoted
      const otelDepEnvFilters = notPromoted ? defaultDepEnvFilter : [];
      const otelFilters = [...otelDepEnvFilters, ...urlOtelResources];
      otelResourcesVariable.setState({
        filters: otelFilters,
        hide: VariableHide.hideVariable,
      });

      const isPromoted = !notPromoted;
      // if the dep env IS PROMOTED
      // we need to ask, does var filters already contain it?
      // keep previous filters if they are there
      // add the dep env to var filters if not present and isPromoted
      const depEnvFromVarFilters = prevVarFilters.filter((f) => f.key === 'deployment_environment');

      // if promoted and no dep env has been chosen yet, set the default
      if (isPromoted && depEnvFromVarFilters.length === 0) {
        prevVarFilters = [...prevVarFilters, ...defaultDepEnvFilter];
      }

      prevVarFilters = [...prevVarFilters, ...urlVarFilters];

      filtersVariable.setState({
        filters: prevVarFilters,
        hide: VariableHide.hideVariable,
      });
    }
  }
  // 1. Get the otel join query for state and variable
  // Because we need to define the deployment environment variable
  // we also need to update the otel join query state and variable
  const resourcesObject: OtelResourcesObject = getOtelResourcesObject(trail);
  // THIS ASSUMES THAT WE ALWAYS HAVE DEPLOYMENT ENVIRONMENT!
  // FIX THIS SO THAT WE HAVE SOME QUERY EVEN IF THERE ARE NO OTEL FILTERS
  const otelJoinQuery = getOtelJoinQuery(resourcesObject);

  // update the otel join query variable too
  otelJoinQueryVariable.setState({ value: otelJoinQuery });

  // 2. Update state with the following
  // - otel join query
  // - otelTargets used to filter metrics
  // now we can filter target_info targets by deployment_environment="somevalue"
  // and use these new targets to reduce the metrics
  // for initialization we also update the following
  // - has otel resources flag
  // - and default to useOtelExperience
  const otelTargets = await totalOtelResources(datasourceUid, timeRange, resourcesObject.filters);

  // we pass in deploymentEnvironments and hasOtelResources on start
  // RETHINK We may be able to get rid of this check
  // a non standard data source is more missing job and instance matchers
  if (hasOtelResources && deploymentEnvironments && !initialOtelCheckComplete) {
    trail.setState({
      otelTargets,
      otelJoinQuery,
      hasOtelResources,
      // Previously checking standardization for having deployment environments
      // Now we check that there are target_info labels that are not promoted
      isStandardOtel: (nonPromotedOtelResources ?? []).length > 0,
      useOtelExperience: isEnabledInLocalStorage,
      nonPromotedOtelResources,
      initialOtelCheckComplete: true,
      resettingOtel: false,
      afterFirstOtelCheck: true,
      isUpdatingOtel: false,
    });
  } else {
    // we are updating on variable changes
    trail.setState({
      otelTargets,
      otelJoinQuery,
      resettingOtel: false,
      afterFirstOtelCheck: true,
      isUpdatingOtel: false,
      nonPromotedOtelResources,
    });
  }
}

function checkLabelPromotion(filters: AdHocVariableFilter[], nonPromotedOtelResources: string[] = []) {
  const nonPromotedResources = new Set(nonPromotedOtelResources);
  const nonPromoted = filters.filter((f) => nonPromotedResources.has(f.key));
  const promoted = filters.filter((f) => !nonPromotedResources.has(f.key));

  return {
    nonPromoted,
    promoted,
  };
}

/**
 * When a new filter is chosen from the consolidated filters, VAR_OTEL_AND_METRIC_FILTERS,
 * we need to identify the following:
 *
 * 1. Is the filter a non-promoted otel resource or a metric filter?
 * 2. Is the filter being added or removed?
 *
 * Once we know this, we can add the selected filter to either the
 * VAR_OTEL_RESOURCES or VAR_FILTERS variable.
 *
 * When the correct variable is updated, the rest of the Metrics Drilldown behavior will remain the same.
 *
 * @param newStateFilters
 * @param prevStateFilters
 * @param nonPromotedOtelResources
 * @param otelFiltersVariable
 * @param filtersVariable
 */
export function manageOtelAndMetricFilters(
  newStateFilters: AdHocVariableFilter[],
  prevStateFilters: AdHocVariableFilter[],
  nonPromotedOtelResources: string[],
  otelFiltersVariable: AdHocFiltersVariable,
  filtersVariable: AdHocFiltersVariable
) {
  // add filter
  if (newStateFilters.length > prevStateFilters.length) {
    const newFilter = newStateFilters[newStateFilters.length - 1];
    // check that the filter is a non-promoted otel resource
    if (nonPromotedOtelResources?.includes(newFilter.key)) {
      // add to otel filters
      otelFiltersVariable.setState({
        filters: [...otelFiltersVariable.state.filters, newFilter],
      });
      reportChangeInLabelFilters(newStateFilters, prevStateFilters, true);
    } else {
      // add to metric filters
      filtersVariable.setState({
        filters: [...filtersVariable.state.filters, newFilter],
      });
    }
    return;
  }
  // remove filter
  if (newStateFilters.length < prevStateFilters.length) {
    // get the removed filter
    const removedFilter = prevStateFilters.filter((f) => !newStateFilters.includes(f))[0];
    if (nonPromotedOtelResources?.includes(removedFilter.key)) {
      // remove from otel filters
      otelFiltersVariable.setState({
        filters: otelFiltersVariable.state.filters.filter((f) => f.key !== removedFilter.key),
      });
      reportChangeInLabelFilters(newStateFilters, prevStateFilters, true);
    } else {
      // remove from metric filters
      filtersVariable.setState({
        filters: filtersVariable.state.filters.filter((f) => f.key !== removedFilter.key),
      });
    }
    return;
  }
  // a filter has been changed
  let updatedFilter: AdHocVariableFilter[] = [];
  if (
    newStateFilters.length === prevStateFilters.length &&
    newStateFilters.some((filter, i) => {
      const newKey = filter.key;
      const newValue = filter.value;
      const isUpdatedFilter = prevStateFilters[i].key === newKey && prevStateFilters[i].value !== newValue;
      if (isUpdatedFilter) {
        updatedFilter.push(filter);
      }
      return isUpdatedFilter;
    })
  ) {
    // check if the filter is a non-promoted otel resource
    if (nonPromotedOtelResources?.includes(updatedFilter[0].key)) {
      // add to otel filters
      otelFiltersVariable.setState({
        // replace the updated filter
        filters: otelFiltersVariable.state.filters.map((f) => {
          if (f.key === updatedFilter[0].key) {
            return updatedFilter[0];
          }
          return f;
        }),
      });
      reportChangeInLabelFilters(newStateFilters, prevStateFilters, true);
    } else {
      // add to metric filters
      filtersVariable.setState({
        // replace the updated filter
        filters: filtersVariable.state.filters.map((f) => {
          if (f.key === updatedFilter[0].key) {
            return updatedFilter[0];
          }
          return f;
        }),
      });
    }
  }
}
