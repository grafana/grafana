import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { isFreeTierLicense } from './isFreeTierLicense';

type syncState = {
  instanceConnected: boolean;
  folderConnected: boolean;
  repoCount: number;
  maxReposReached: boolean;
};

export function checkSyncSettings(repos?: Repository[]): syncState {
  if (!repos?.length) {
    return {
      instanceConnected: false,
      folderConnected: false,
      repoCount: 0,
      maxReposReached: false,
    };
  }

  const repoCount = repos.length;
  const maxReposReached = isFreeTierLicense() ? repoCount >= 1 : false;

  return {
    instanceConnected: repos.some((item) => item.spec?.sync.target === 'instance'),
    folderConnected: repos.some((item) => item.spec?.sync.target === 'folder'),
    maxReposReached,
    repoCount,
  };
}
