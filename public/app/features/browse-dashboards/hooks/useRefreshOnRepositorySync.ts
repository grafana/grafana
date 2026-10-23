import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect } from 'react';

import { config } from '@grafana/runtime';
import {
  type Repository,
  useGetFrontendSettingsQuery,
  useListRepositoryQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { useSearchStateManager } from 'app/features/search/state/SearchStateManager';
import { type ThunkResult, useDispatch } from 'app/types/store';

import { PAGE_SIZE } from '../api/constants';
import { refetchChildren } from '../state/actions';
import { clearFolders } from '../state/slice';

/**
 * Last synced ref per repository, across mounts. The browse tree cache lives as long as the page,
 * so this baseline must too: a pull that lands while the user is on a dashboard still has to be
 * noticed when they come back to the list. A component ref would reseed on every mount and miss it.
 */
const lastSyncedRefs = new Map<string, string>();

function hasNewSyncedRef(repositories: Repository[]): boolean {
  let changed = false;
  for (const repository of repositories) {
    const name = repository.metadata?.name;
    if (!name) {
      continue;
    }
    // `lastRef` only moves when a successful pull reached a new commit, so interval syncs that
    // found nothing and failed pulls never refresh the list. `finished` would fire every interval.
    const ref = repository.status?.sync?.lastRef ?? '';
    const previous = lastSyncedRefs.get(name);
    if (previous !== undefined && previous !== ref) {
      changed = true;
    }
    lastSyncedRefs.set(name, ref);
  }
  return changed;
}

/**
 * Refetches what the user is looking at and drops every other loaded collection, so folders
 * reload when opened or visited next. A pull can touch any folder in the repository and the
 * frontend does not learn which.
 *
 * Selection is left alone: clearing it unmounts BrowseActions together with any bulk-action
 * drawer still showing its job result, and a direct-write bulk job is followed by a pull within
 * seconds.
 */
function refreshBrowseTree(folderUID: string | undefined): ThunkResult<void> {
  return (dispatch, getState) => {
    const { rootItems, childrenByParentUID } = getState().browseDashboards;
    const otherCollections = [undefined, ...Object.keys(childrenByParentUID)].filter((uid) => uid !== folderUID);
    dispatch(clearFolders(otherCollections));

    // A collection that is still loading gets fresh data from its own first page.
    const viewed = folderUID ? childrenByParentUID[folderUID] : rootItems;
    if (viewed) {
      dispatch(refetchChildren({ parentUID: folderUID, pageSize: PAGE_SIZE }));
    }
  };
}

/**
 * Keeps the Browse Dashboards list in step with Git Sync: when a repository pull reaches a new
 * commit, the viewed folder is refetched and the active search re-run, so dashboards deleted,
 * added or moved through a merged pull request show up without a reload.
 *
 * Watches the repository status, not the Job: pulls started by webhooks or the sync interval
 * never have a Job the UI knows about. All repositories are watched from one list query: at the
 * root any repository's content is in view, and one spare refresh when another repository pulls
 * is cheaper than a watch per repository. Instances without repositories open no watch.
 */
export function useRefreshOnRepositorySync(folderUID: string | undefined) {
  const dispatch = useDispatch();
  const [, stateManager] = useSearchStateManager();

  const { data: settings } = useGetFrontendSettingsQuery(config.provisioningEnabled ? undefined : skipToken);
  const hasRepositories = (settings?.items.length ?? 0) > 0;
  const { data: repositories } = useListRepositoryQuery(hasRepositories ? { watch: true } : skipToken);

  useEffect(() => {
    if (!repositories?.items || !hasNewSyncedRef(repositories.items)) {
      return;
    }
    dispatch(refreshBrowseTree(folderUID));
    if (stateManager.hasSearchFilters()) {
      stateManager.doSearchWithDebounce();
    }
  }, [repositories, folderUID, dispatch, stateManager]);
}
