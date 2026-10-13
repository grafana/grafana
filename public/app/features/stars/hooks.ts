import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type IconName, locationUtil } from '@grafana/data';
import {
  collectionsAPIv1alpha1,
  useAddStarMutation,
  useRemoveStarMutation,
  useListStarsQuery,
} from 'app/api/clients/collections/v1alpha1';
import { setStarred, setStarredItems, type StarredNavItem } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { getFolderURL, starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { getIconForKind } from 'app/features/search/service/utils';
import { dispatch } from 'app/store/store';

import { loadStarredPages, PAGE_API_GROUP } from './pages';
import { findStarredNames, userStarsFieldSelector } from './utils';

type StarItemArgs = {
  id: string;
  /** Title of the item - this is displayed in the nav */
  title: string;
};

// Positive sortWeight pushes starred folders below dashboards in the nav; dashboards carry none
const STARRED_FOLDER_SORT_WEIGHT = 1;

/** Nav Starred entry (url + icon + sort rank) for a starred item, or undefined when this kind isn't shown in the nav. */
function starredNavEntry(
  group: string,
  kind: string,
  id: string
): { url: string; icon?: IconName; sortWeight?: number } | undefined {
  const foldersEnabled = starredFoldersEnabled();
  if (group === DASHBOARD_API_GROUP && kind === 'Dashboard') {
    // Icon only when folders can be starred too — that's when kinds need distinguishing
    return {
      url: locationUtil.assureBaseUrl(`/d/${id}`),
      icon: foldersEnabled ? getIconForKind('dashboard') : undefined,
    };
  }
  if (group === FOLDER_API_GROUP && kind === 'Folder' && foldersEnabled) {
    return { url: getFolderURL(id), icon: getIconForKind('folder'), sortWeight: STARRED_FOLDER_SORT_WEIGHT };
  }
  return undefined;
}

/** Star or unstar an item */
export const useStarItem = (group: string, kind: string) => {
  const [addStar] = useAddStarMutation();
  const [removeStar] = useRemoveStarMutation();

  return async ({ id, title }: StarItemArgs, newStarredState: boolean) => {
    const name = `user-${contextSrv.user.uid}`;
    const mutationArgs = { id, name, group, kind };
    try {
      if (newStarredState) {
        await addStar(mutationArgs).unwrap();
      } else {
        await removeStar(mutationArgs).unwrap();
      }
    } catch {
      // Server rejected the change — leave the nav as-is rather than showing state that didn't persist
      return;
    }

    const entry = starredNavEntry(group, kind, id);
    if (entry) {
      dispatch(
        setStarred({
          id,
          title,
          url: entry.url,
          icon: entry.icon,
          sortWeight: entry.sortWeight,
          isStarred: newStarredState,
        })
      );
    }
  };
};

/**
 * Get starred items from the app platform API
 */
export const useStarredItems = (group: string, kind: string, options?: { skip?: boolean }) => {
  const skip = options?.skip ?? false;
  const response = useListStarsQuery(skip ? skipToken : { fieldSelector: userStarsFieldSelector() });

  const starredItems = useMemo(() => {
    const { data, isLoading, isUninitialized } = response;

    // If query hasn't been initiated yet or is still loading, return undefined to show loading state
    if (isUninitialized || isLoading) {
      return undefined;
    }

    // If query completed but no data, return empty array
    if (!data) {
      return [];
    }

    return findStarredNames(data, group, kind);
  }, [response, group, kind]);

  return {
    ...response,
    data: starredItems,
    // Ensure isLoading is true when data is undefined (still loading or uninitialized)
    isLoading: starredItems === undefined ? true : response.isLoading,
  };
};

// Matches the backend cap on starred nav children in bootData (buildStarredItemsNavLinks)
const STARRED_NAV_CAP = 50;

/**
 * Sync starred dashboards into the nav tree on mount and when the star set changes.
 * Replaces whatever the backend shipped in bootData (which is empty in dual-writer mode 5).
 */
export const useSyncStarredItemsInNav = () => {
  const foldersEnabled = starredFoldersEnabled();
  const {
    data: dashboardUids,
    isLoading: dashboardsLoading,
    isError: dashboardsError,
    fulfilledTimeStamp,
  } = useStarredItems(DASHBOARD_API_GROUP, 'Dashboard');
  const {
    data: folderUids,
    isLoading: folderLoadingRaw,
    isError: folderError,
  } = useStarredItems(FOLDER_API_GROUP, 'Folder', { skip: !foldersEnabled });

  const { data: pageUids, isLoading: pagesLoading, isError: pagesError } = useStarredItems(PAGE_API_GROUP, 'Page');

  useEffect(() => {
    const refresh = () => {
      dispatch(collectionsAPIv1alpha1.util.invalidateTags(['Stars']));
    };
    window.addEventListener('grafana-stars-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('grafana-stars-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  // A skipped useStarredItems reports isLoading:true indefinitely, so only honor
  // the folder query's loading/error when the feature is actually on.
  const folderLoading = foldersEnabled ? folderLoadingRaw : false;
  const isLoading = dashboardsLoading || folderLoading || pagesLoading;
  const isError = dashboardsError || (foldersEnabled && folderError) || pagesError;

  // Initialized from the stars query so a remount with a warm RTK cache doesn't
  // flash a loading state — the nav tree is already correct from the prior sync
  const [hasSynced, setHasSynced] = useState(!isLoading);
  const [searchFailed, setSearchFailed] = useState(false);

  // Stable identities so the effect doesn't re-fire when an array ref changes but content is identical
  const dashboardKey = useMemo(() => dashboardUids && [...dashboardUids].sort().join(','), [dashboardUids]);
  const folderKey = useMemo(
    () => (foldersEnabled ? folderUids && [...folderUids].sort().join(',') : ''),
    [folderUids, foldersEnabled]
  );

  const pageKey = useMemo(() => pageUids && [...pageUids].sort().join(','), [pageUids]);

  useEffect(() => {
    if (isLoading || dashboardKey === undefined || folderKey === undefined || pageKey === undefined) {
      return;
    }

    const pageNames = pageKey === '' ? [] : pageKey.split(',');
    const dashboardNames = dashboardKey === '' ? [] : dashboardKey.split(',');
    const folderNames = folderKey === '' ? [] : folderKey.split(',');
    // Dedupe so a uid starred as both kinds can't occupy two cap slots or render twice
    const names = [...new Set([...dashboardNames, ...folderNames])].sort().slice(0, STARRED_NAV_CAP);

    if (names.length === 0 && pageNames.length === 0) {
      dispatch(setStarredItems({ uids: [], items: [] }));
      setHasSynced(true);
      setSearchFailed(false);
      return;
    }

    const kinds = foldersEnabled ? ['dashboard', 'folder'] : ['dashboard'];
    // The search matches the uid union against both kinds, so a cross-kind uid collision can
    // return an item that was never starred as that kind — keep only kind-matching hits.
    const starredUidsByKind: Record<string, Set<string> | undefined> = {
      dashboard: new Set(dashboardNames),
      folder: new Set(folderNames),
    };
    let cancelled = false;

    Promise.allSettled([
      names.length > 0 ? getGrafanaSearcher().search({ name: names, kind: kinds }) : Promise.resolve(undefined),
      loadStarredPages(pageNames, STARRED_NAV_CAP - names.length),
    ])
      .then(([searchResult, pageResult]) => {
        if (cancelled) {
          return;
        }
        if (searchResult.status === 'rejected') {
          throw searchResult.reason;
        }
        const response = searchResult.value;
        const pages = pageResult.status === 'fulfilled' ? pageResult.value : [];
        const items: StarredNavItem[] = [];
        for (let i = 0; i < (response?.view.length ?? 0); i++) {
          const row = response?.view.get(i);
          if (!row) {
            continue;
          }
          if (!starredUidsByKind[row.kind]?.has(row.uid)) {
            continue;
          }
          items.push({
            id: row.uid,
            title: row.name,
            url: row.url,
            icon: foldersEnabled ? getIconForKind(row.kind) : undefined,
            sortWeight: row.kind === 'folder' ? STARRED_FOLDER_SORT_WEIGHT : undefined,
          });
        }
        // Do not preserve stale Page metadata when catalog access has been revoked.
        dispatch(setStarredItems({ uids: [...names, ...pages.map((page) => page.id)], items: [...items, ...pages] }));
        setHasSynced(true);
        setSearchFailed(pageResult.status === 'rejected');
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to sync starred items to nav', err);
        // Resolve the loading state rather than showing it forever
        setHasSynced(true);
        setSearchFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [dashboardKey, folderKey, pageKey, isLoading, foldersEnabled, fulfilledTimeStamp]);

  return { isLoading: isLoading || !hasSynced, isError: isError || searchFailed };
};
