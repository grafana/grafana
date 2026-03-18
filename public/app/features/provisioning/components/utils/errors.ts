import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { extractErrorMessage } from 'app/api/utils';

type ResourceType = 'dashboard' | 'folder';

export function getProvisionedRequestError(
  error: unknown,
  resourceType: ResourceType,
  fallbackMessage: string
): string {
  if (isFetchError(error) && error.status === 404) {
    return resourceType === 'dashboard'
      ? t(
          'provisioning.error.branch-not-found-dashboard',
          'You have selected a branch that does not contain this dashboard. Select another branch.'
        )
      : t(
          'provisioning.error.branch-not-found-folder',
          'You have selected a branch that does not contain this folder. Select another branch.'
        );
  }

  return extractErrorMessage(error) || fallbackMessage;
}
