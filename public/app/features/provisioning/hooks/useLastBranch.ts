import { useCallback } from 'react';

import { store } from '@grafana/data';

const LAST_BRANCH_KEY_PREFIX = 'grafana.provisioning.lastBranch';

/**
 * Get the local storage key for a repository's last used branch
 */
const getStorageKey = (repositoryName: string) => {
  return `${LAST_BRANCH_KEY_PREFIX}.${repositoryName}`;
};

/**
 * Hook to manage the last used branch per repository in local storage
 */
export const useLastBranch = () => {
  const getLastBranch = useCallback((repositoryName: string | undefined): string | undefined => {
    if (!repositoryName) {
      return undefined;
    }
    const key = getStorageKey(repositoryName);
    return store.get(key) || undefined;
  }, []);

  const setLastBranch = useCallback((repositoryName: string | undefined, branch: string | undefined) => {
    if (!repositoryName || !branch) {
      return;
    }
    const key = getStorageKey(repositoryName);
    store.set(key, branch);
  }, []);

  return { getLastBranch, setLastBranch };
};
