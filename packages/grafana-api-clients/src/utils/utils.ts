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
 * Normalize error from various error formats into a string message
 * @param e the raw error
 * @returns string error message
 */
export const normalizeError = (e: unknown): string => {
  if (!e) {
    return 'Unknown error';
  }

  if (typeof e === 'object') {
    if ('data' in e && e.data && typeof e.data === 'object' && 'message' in e.data) {
      return String(e.data.message);
    }

    // Direct error with message property
    if ('message' in e) {
      return String(e.message);
    }

    // Nested error wrapper (RTK Query format)
    if ('error' in e) {
      if (e.error instanceof Error) {
        return e.error.message;
      } else if (isFetchError(e.error)) {
        if (e.error.data && typeof e.error.data === 'object' && 'message' in e.error.data) {
          return String(e.error.data.message);
        }
        if (Array.isArray(e.error.data.errors) && e.error.data.errors.length) {
          return e.error.data.errors.join('\n');
        }
      }
    }
  }

  if (e instanceof Error) {
    return e.message;
  }

  return String(e);
};
export function handleRequestError(error: unknown) {
  if (isFetchError(error) || error instanceof Error) {
    return { error };
  } else {
    return { error: new Error('Unknown error') };
  }
}
