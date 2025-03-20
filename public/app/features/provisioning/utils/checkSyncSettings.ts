import { RepositoryViewList } from 'app/api/clients/provisioning';

export function checkSyncSettings(settings?: RepositoryViewList): [boolean, boolean, boolean] {
  if (!settings?.items?.length) {
    return [false, false, false];
  }
  const instanceConnected = settings.items.some((item) => item.target === 'instance');
  const folderConnected = settings.items.some((item) => item.target === 'folder');
  const maxReposReached = Boolean((settings.items ?? []).length >= 10);

  return [instanceConnected, folderConnected, maxReposReached];
}
