import { MetricFindValue } from '@grafana/data';

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
