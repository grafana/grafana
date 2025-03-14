import { RepositoryViewList } from '../../../api/clients/provisioning';

export function checkSyncSettings(settings?: RepositoryViewList): [boolean, boolean] {
  if (!settings?.items?.length) {
    return [false, false];
  }
  const instanceConnected = settings.items.some((item) => item.target === 'instance');
  const folderConnected = settings.items.some((item) => item.target === 'folder');
  return [instanceConnected, folderConnected];
}
