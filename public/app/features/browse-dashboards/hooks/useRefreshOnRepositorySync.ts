import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect } from 'react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery, useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { lastSuccessfulSync } from 'app/features/provisioning/hooks/useRefetchOnRepoSync';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types/store';

import { refreshTree } from '../state/actions';
import { setRepositorySyncedAt } from '../state/slice';

/**
 * Keeps the Browse Dashboards list in step with Git Sync: when a repository pull writes content,
 * the viewed folder is refetched and the active search re-run, so dashboards deleted, added or
 * moved through a merged pull request show up without a reload.
 *
 * Watches the repository status, not the Job: pulls started by webhooks or the sync interval
 * never have a Job the UI knows about. All repositories are watched from one list query: at the
 * root any repository's content is in view, and one spare refresh when another repository pulls
 * is cheaper than a watch per repository. Instances without repositories open no watch.
 */
export function useRefreshOnRepositorySync(folderUID: string | undefined) {
  const dispatch = useDispatch();
  const [, stateManager] = useSearchStateManager();
  const syncedAt = useSelector((state) => state.browseDashboards.repositorySyncedAt);

  const { data: settings } = useGetFrontendSettingsQuery(config.provisioningEnabled ? undefined : skipToken);
  const hasRepositories = (settings?.items.length ?? 0) > 0;
  const { data: repositories } = useListRepositoryQuery(hasRepositories ? { watch: true } : skipToken);
  const lastSync = repositories?.items ? lastSuccessfulSync(repositories.items) : undefined;

  useEffect(() => {
    if (lastSync === undefined || (syncedAt !== undefined && lastSync <= syncedAt)) {
      return;
    }
    dispatch(setRepositorySyncedAt(lastSync));
    // The first value only seeds the baseline: the loaded tree is at least as new as this page.
    if (syncedAt === undefined) {
      return;
    }
    dispatch(refreshTree({ folderUID }));
    if (stateManager.hasSearchFilters()) {
      stateManager.doSearchWithDebounce();
    }
  }, [lastSync, syncedAt, folderUID, dispatch, stateManager]);
}
