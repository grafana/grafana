import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { extractErrorMessage } from 'app/api/utils';

type ResourceType = 'dashboard' | 'folder' | 'playlist';

const API_FILE_NOT_FOUND = 'file not found'; // from apps/provisioning/pkg/repository/repository.go

export function getProvisionedRequestError(
  error: unknown,
  resourceType: ResourceType,
  fallbackMessage: string
): string {
  if (isFetchError(error) && error.status === 404) {
    const apiMessage = typeof error.data?.message === 'string' ? error.data.message : '';

    if (apiMessage === API_FILE_NOT_FOUND) {
      switch (resourceType) {
        case 'dashboard':
          return t(
            'provisioning.error.branch-not-found-dashboard',
            'You have selected a branch that does not contain this dashboard. Select another branch.'
          );
        case 'playlist':
          return t(
            'provisioning.error.branch-not-found-playlist',
            'You have selected a branch that does not contain this playlist. Select another branch.'
          );
        case 'folder':
        default:
          return t(
            'provisioning.error.branch-not-found-folder',
            'You have selected a branch that does not contain this folder. Select another branch.'
          );
      }
    }

    return apiMessage || fallbackMessage;
  }

  return extractErrorMessage(error, fallbackMessage);
}
