import { normalizeError } from '@grafana/api-clients';
import { ThunkDispatch } from 'app/types/store';

import { notifyApp } from '../core/actions';
import { createErrorNotification } from '../core/copy/appNotification';

/**
 * Handle an error from a k8s API call
 * @param e the raw error
 * @param dispatch store dispatch function
 * @param message error alert title. error details will also be surfaced
 */
export const handleError = (e: unknown, dispatch: ThunkDispatch, message: string) => {
  const errorMessage = normalizeError(e);
  dispatch(notifyApp(createErrorNotification(message, errorMessage)));
};

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

// TODO: Change imports to be directly from api-clients package
// Best done after hackathon
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { getAPIBaseURL, getAPINamespace } from '@grafana/api-clients';
