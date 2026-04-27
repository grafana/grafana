import { normalizeError } from '@grafana/api-clients';
import { isObject } from '@grafana/data/types';
import { type ThunkDispatch } from 'app/types/store';

import { createErrorNotification } from '../core/copy/appNotification';
import { notifyApp } from '../core/reducers/appNotification';
import { isStatusFailure } from '../features/apiserver/guards';
import { type K8sStatusCause } from '../features/apiserver/types';

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

/**
 * Extracts a human-readable message from an unknown error value.
 * @param error The raw error value to inspect.
 * @param fallback Optional fallback message returned when no extractable message is found.
 * @returns A message string if extracted; otherwise returns `fallbackMsg` when provided, or `undefined`.
 *
 * **Overloads:**
 * - `extractErrorMessage(error)` returns `string | undefined`
 * - `extractErrorMessage(error, fallbackMsg)` returns `string`
 */
export function extractErrorMessage(error: unknown): string | undefined;
export function extractErrorMessage(error: unknown, fallback: string): string;
export function extractErrorMessage(error: unknown, fallback?: string): string | undefined {
  if (typeof error === 'string') {
    return error;
  }

  if (isObject(error)) {
    if ('data' in error && isObject(error.data) && 'message' in error.data && error.data.message != null) {
      return String(error.data.message);
    }
    if ('message' in error && error.message != null) {
      return String(error.message);
    }

    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }
  return fallback; // when no fallback is provided, undefined is returned
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
