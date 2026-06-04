import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { extractErrorMessage } from 'app/api/utils';

import { type ProvisionedResourceType } from '../../types/resource';

const API_FILE_NOT_FOUND = 'file not found'; // from apps/provisioning/pkg/repository/repository.go

export function getProvisionedRequestError(
  error: unknown,
  resourceType: ProvisionedResourceType,
  fallbackMessage: string
): string {
  if (isFetchError(error) && error.status === 404) {
    const apiMessage = typeof error.data?.message === 'string' ? error.data.message : '';

    if (apiMessage === API_FILE_NOT_FOUND) {
      // Generic over the resource type so new types work without a parallel switch here.
      return t(
        'provisioning.error.branch-not-found',
        'You have selected a branch that does not contain this {{resourceType}}. Select another branch.',
        { resourceType }
      );
    }

    return apiMessage || fallbackMessage;
  }

  return extractErrorMessage(error, fallbackMessage);
}
