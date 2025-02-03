import { config } from '@grafana/runtime';

export const getAPINamespace = () => config.namespace;

/**
 * Get a base URL for a k8s API endpoint with parameterised namespace given it's group and version
 * @param group the k8s group, e.g. dashboard.grafana.app
 * @param version e.g. v0alpha1
 * @returns
 */
export const getAPIBaseURL = (group: string, version: string) => {
  return `/apis/${group}/${version}/namespaces/${getAPINamespace()}`;
};
