import { Repository } from 'app/api/clients/provisioning/v0alpha1';

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
  return {
    instanceConnected: repos.some((item) => item.spec?.sync.target === 'instance'),
    folderConnected: repos.some((item) => item.spec?.sync.target === 'folder'),
    maxReposReached: Boolean((repos ?? []).length >= 10),
    repoCount: repos.length,
  };
}
