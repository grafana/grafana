// Provisioning-specific error message helpers for HTTP and fetch errors.
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { isHttpError } from 'app/features/provisioning/guards';

export function getErrorMessage(err: unknown) {
  if (isFetchError(err)) {
    return err.data.message;
  }

  let errorMessage = t('provisioning.http-utils.request-failed', 'Request failed');

  if (!isHttpError(err)) {
    return errorMessage;
  }

  if (err.status === 401) {
    return t('provisioning.http-utils.authentication-failed', 'Authentication failed. Please check your access token.');
  }

  if (err.status === 404) {
    return t('provisioning.http-utils.resource-not-found', 'Resource not found. Please check the URL or repository.');
  }

  if (err.status === 403) {
    return t('provisioning.http-utils.access-denied', 'Access denied. Please check your token permissions.');
  }

  if (err.message) {
    return err.message;
  }

  return errorMessage;
}
