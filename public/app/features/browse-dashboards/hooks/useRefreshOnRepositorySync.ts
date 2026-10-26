import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect } from 'react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery, useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types/store';

import { refreshTree } from '../state/actions';
import { setRepositorySyncedAt } from '../state/slice';

/**
 * Keeps the Browse Dashboards list in step with Git Sync: when a repository pull completes, the
 * part of the tree that repository owns is refreshed and the active search re-run, so dashboards
 * deleted, added or moved through a merged pull request show up without a reload. Folders the
 * repository does not own keep their cache, expansion and selection.
 *
 * Watches the repository status, not the Job: pulls started by webhooks or the sync interval
 * never have a Job the UI knows about. All repositories are watched from one list query; instances
 * without repositories open no watch. Every completed pull counts, whatever its outcome: one that
 * ends in `error` has usually applied every resource but the ones it reports, and the status
 * only holds the last pull.
 *
 * `viewedRepository` names the repository owning the folder in view, if any; the tree holds no
 * item for that folder, so its owner cannot be read from the cache.
 */
export function useRefreshOnRepositorySync(folderUID: string | undefined, viewedRepository: string | undefined) {
  const dispatch = useDispatch();
  const [, stateManager] = useSearchStateManager();
  const syncedAt = useSelector((state) => state.browseDashboards.repositorySyncedAt);

  const { data: settings } = useGetFrontendSettingsQuery(config.provisioningEnabled ? undefined : skipToken);
  const hasRepositories = (settings?.items.length ?? 0) > 0;
  const { data: repositories } = useListRepositoryQuery(hasRepositories ? { watch: true } : skipToken);

  useEffect(() => {
    if (!repositories?.items) {
      return;
    }
    const unseen: Record<string, number> = {};
    let pulled = false;
    for (const repository of repositories.items) {
      const name = repository.metadata?.name;
      const target = repository.spec?.sync?.target;
      if (!name || !target) {
        continue;
      }
      const finished = repository.status?.sync?.finished ?? 0;
      const seen = syncedAt?.[name];
      // The first value only seeds the baseline: the loaded tree is at least as new as this page.
      if (seen === undefined) {
        unseen[name] = finished;
      } else if (finished > seen) {
        pulled = true;
        dispatch(
          refreshTree({
            repository: { name, target },
            viewed: { folderUID, repository: viewedRepository },
            syncedAt: finished,
          })
        );
      }
    }
    if (Object.keys(unseen).length > 0) {
      dispatch(setRepositorySyncedAt(unseen));
    }
    if (pulled && stateManager.hasSearchFilters()) {
      stateManager.doSearchWithDebounce();
    }
  }, [repositories, syncedAt, folderUID, viewedRepository, dispatch, stateManager]);
}
