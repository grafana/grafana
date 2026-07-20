import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { extractErrorMessage } from 'app/api/utils';

const API_FILE_NOT_FOUND = 'file not found'; // from apps/provisioning/pkg/repository/repository.go

export function getProvisionedRequestError(error: unknown, fallbackMessage: string): string {
  if (isFetchError(error) && error.status === 404) {
    const apiMessage = typeof error.data?.message === 'string' ? error.data.message : '';

    if (apiMessage === API_FILE_NOT_FOUND) {
      // Resource-agnostic so it reads the same for any type and needs no interpolation.
      return t(
        'provisioning.error.branch-not-found',
        'You have selected a branch that does not contain this resource. Select another branch.'
      );
    }

    return apiMessage || fallbackMessage;
  }

  return extractErrorMessage(error, fallbackMessage);
}
