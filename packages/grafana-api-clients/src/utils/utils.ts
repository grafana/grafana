import { config, isFetchError } from '@grafana/runtime';

export const getAPINamespace = () => config.namespace;

/**
 * Get a base URL for a k8s API endpoint with parameterised namespace given it's group and version
 * @param group the k8s group, e.g. dashboard.grafana.app
 * @param version e.g. v0alpha1
 * @returns
 */
export const getAPIBaseURL = (group: string, version: string) => {
  return `/apis/${group}/${version}/namespaces/${getAPINamespace()}` as const;
};

/**
 * Extract error message from various error formats
 * @param e the raw error
 * @returns string error message
 */
export const handleError = (e: unknown) => {
  if (!e) {
    return new Error('Unknown error');
  } else if (e instanceof Error) {
    return e;
  } else if (typeof e === 'object' && 'error' in e) {
    if (e.error instanceof Error) {
      return e.error;
    } else if (isFetchError(e.error)) {
      if (Array.isArray(e.error.data.errors) && e.error.data.errors.length) {
        return e.error.data.errors.join('\n');
      }
    }
  }
};
