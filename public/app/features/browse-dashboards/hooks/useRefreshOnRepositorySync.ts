import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect } from 'react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery, useListRepositoryQuery } from 'app/api/clients/provisioning/v0alpha1';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { useDispatch, useSelector } from 'app/types/store';

import { refreshTree } from '../state/actions';
import { setAllSelection, setRepositorySyncedAt } from '../state/slice';
import { type ViewedFolder } from '../state/utils';

/**
 * Refreshes the part of the browse tree a repository owns when one of its pulls completes, and
 * re-runs an active search, so changes merged upstream show up without a reload. Watches the
 * repository status rather than the Job: webhook and interval pulls have no Job the UI knows
 * about. Every completed pull counts, whatever its outcome: a pull that ends in `error` has
 * usually applied most resources, and the status only holds the last pull.
 *
 * `viewed` is the folder in view with its owning repository (its own item is not in the tree).
 * Pass `undefined` while the owner is unresolved: pulls wait, since a repository is only stamped
 * once its refresh succeeded.
 */
export function useRefreshOnRepositorySync(viewed: ViewedFolder | undefined) {
  const dispatch = useDispatch();
  const [, stateManager] = useSearchStateManager();
  const syncedAt = useSelector((state) => state.browseDashboards.repositorySyncedAt);
  const resolved = viewed !== undefined;
  const folderUID = viewed?.folderUID;
  const viewedRepository = viewed?.repository;

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
      } else if (finished > seen && resolved) {
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
      // Search results are not in the tree, so the refresh cannot tell which selected results the
      // pull touched; the re-run replaces them, and the selection made against them goes with it.
      dispatch(setAllSelection({ isSelected: false, folderUID: undefined }));
      stateManager.doSearchWithDebounce();
    }
  }, [repositories, syncedAt, resolved, folderUID, viewedRepository, dispatch, stateManager]);
}
