import { normalizeError } from '@grafana/api-clients';
import { isObject } from '@grafana/data';
import { ThunkDispatch } from 'app/types/store';

import { createErrorNotification } from '../core/copy/appNotification';
import { notifyApp } from '../core/reducers/appNotification';
import { isStatusFailure } from '../features/apiserver/guards';
import { K8sStatusCause } from '../features/apiserver/types';

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
  if (isObject(error)) {
    if ('data' in error && isObject(error.data) && 'message' in error.data) {
      return String(error.data.message);
    }
    if ('message' in error) {
      return String(error.message);
    }
  }
  return String(error);
}

/**
 * Extract field-level error causes from a Kubernetes Status failure response.
 * Generic type parameter allows callers to specify the client-specific StatusCause type.
 * Returns an empty array if not a Status failure or no causes found.
 */
export function extractStatusCauses<T extends K8sStatusCause = K8sStatusCause>(data: unknown): T[] {
  if (isStatusFailure(data)) {
    const causes = data.details?.causes;
    if (causes) {
      // Type assertion is safe here because isStatusFailure validates the structure
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return causes as T[];
    }
  }
  return [];
}

// TODO: Change imports to be directly from api-clients package
// Best done after hackathon
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { getAPIBaseURL, getAPINamespace } from '@grafana/api-clients';
