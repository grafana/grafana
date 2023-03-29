export const Messages = {
  clusterUnavailable: (cluster: string, status: string) =>
    `Unable to load DB clusters for ${cluster}. K8s cluster is ${status}`,
};
