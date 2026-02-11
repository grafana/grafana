// Provisioning-specific error message helpers for HTTP and fetch errors.
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { isHttpError } from 'app/features/provisioning/guards';

export function getErrorMessage(err: unknown) {
  let errorMessage = t('provisioning.http-utils.request-failed', 'Request failed');

  if (isHttpError(err)) {
    if (err.status === 401) {
      errorMessage = t(
        'provisioning.http-utils.authentication-failed',
        'Authentication failed. Please check your access token.'
      );
    } else if (err.status === 404) {
      errorMessage = t(
        'provisioning.http-utils.resource-not-found',
        'Resource not found. Please check the URL or repository.'
      );
    } else if (err.status === 403) {
      errorMessage = t('provisioning.http-utils.access-denied', 'Access denied. Please check your token permissions.');
    } else if (err.message) {
      errorMessage = err.message;
    }
  } else if (isFetchError(err)) {
    errorMessage = err.data.message;
  }

  return errorMessage;
}
