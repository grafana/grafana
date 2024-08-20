export const blessedList: Record<string, number> = {
  cloud_availability_zone: 1,
  cloud_region: 2,
  container_name: 3,
  k8s_cluster_name: 4,
  k8s_container_name: 5,
  k8s_cronjob_name: 6,
  k8s_daemonset_name: 7,
  k8s_deployment_name: 8,
  k8s_job_name: 9,
  k8s_namespace_name: 10,
  k8s_pod_name: 11,
  k8s_replicaset_name: 12,
  k8s_statefulset_name: 13,
  service_instance_id: 14,
  service_name: 15,
  service_namespace: 16,
};

export function sortResources(resources: string[], excluded: string[]) {
  // these may be filtered
  const blessed = Object.keys(blessedList).filter((resource) => !excluded.includes(resource));
  resources.filter((resource) => {
    // if not in the list keep it
    if (!blessed.includes(resource)) {
      return true;
    }
    // remove blessed filters
    return false;
  });

  // put the filters first
  return blessed.concat(resources);
}
