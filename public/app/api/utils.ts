import { config, isFetchError } from '@grafana/runtime';
import { ThunkDispatch } from 'app/types/store';

import { notifyApp } from '../core/actions';
import { createErrorNotification } from '../core/copy/appNotification';

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

/**
 * Handle an error from a k8s API call
 * @param e the raw error
 * @param dispatch store dispatch function
 * @param message error alert title. error details will also be surfaced
 */
export const handleError = (e: unknown, dispatch: ThunkDispatch, message: string) => {
  if (!e) {
    dispatch(notifyApp(createErrorNotification(message, new Error('Unknown error'))));
  } else if (e instanceof Error) {
    dispatch(notifyApp(createErrorNotification(message, e)));
  } else if (typeof e === 'object' && 'error' in e) {
    if (e.error instanceof Error) {
      dispatch(notifyApp(createErrorNotification(message, e.error)));
    } else if (isFetchError(e.error)) {
      if (Array.isArray(e.error.data.errors) && e.error.data.errors.length) {
        dispatch(notifyApp(createErrorNotification(message, e.error.data.errors.join('\n'))));
      }
    }
  }
};

// TODO: DELETE
export function extractErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('data' in error && error.data && typeof error.data === 'object' && 'message' in error.data) {
      return String(error.data.message);
    }
    if ('message' in error) {
      return String(error.message);
    }
  }
  return String(error);
}
