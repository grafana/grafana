import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type IconName, locationUtil } from '@grafana/data';
import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { setStarred, setStarredItems, type StarredNavItem } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { getFolderURL, starredFoldersEnabled } from 'app/features/browse-dashboards/utils/dashboards';
import { getIconForKind } from 'app/features/search/service/utils';
import { dispatch } from 'app/store/store';

import { useSearchStarredQuery } from './api';
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

  // Keyed on the response data, not the response: a refetch that returns the same stars keeps the same array.
  const { data, isLoading, isUninitialized } = response;
  const starredItems = useMemo(() => {
    // If query hasn't been initiated yet or is still loading, return undefined to show loading state
    if (isUninitialized || isLoading) {
      return undefined;
    }

    // If query completed but no data, return empty array
    if (!data) {
      return [];
    }

    return findStarredNames(data, group, kind);
  }, [data, isLoading, isUninitialized, group, kind]);

  return {
    ...response,
    data: starredItems,
    // Ensure isLoading is true when data is undefined (still loading or uninitialized)
    isLoading: starredItems === undefined ? true : response.isLoading,
  };
};

/**
 * The user's starred dashboards, and folders where those can be starred, as search rows that follow the star set.
 * The set is RTK cache every star toggle invalidates and the search is keyed by it, so a toggle anywhere re-searches
 * while the previous rows stay up.
 */
export const useStarredSearch = (limit: number) => {
  const foldersEnabled = starredFoldersEnabled();
  const dashboards = useStarredItems(DASHBOARD_API_GROUP, 'Dashboard');
  // A skipped query reports loading forever, so the folder set only counts while the feature is on.
  const folders = useStarredItems(FOLDER_API_GROUP, 'Folder', { skip: !foldersEnabled });
  const starsLoading = dashboards.isLoading || (foldersEnabled && folders.isLoading);

  // Sorted so the cache key is the set, not the order the API listed it in.
  const args = useMemo(
    () =>
      starsLoading || !dashboards.data
        ? skipToken
        : { dashboards: [...dashboards.data].sort(), folders: [...(folders.data ?? [])].sort(), limit },
    [starsLoading, dashboards.data, folders.data, limit]
  );
  const search = useSearchStarredQuery(args, { refetchOnMountOrArgChange: true });

  return {
    uids: search.data?.uids,
    rows: search.data?.rows,
    // Until the first rows land; a changed star set keeps the previous rows up while it loads.
    loading: starsLoading || search.isLoading,
    error: dashboards.isError || (foldersEnabled && folders.isError) || search.isError,
    retry: () => {
      dashboards.refetch();
      if (foldersEnabled) {
        folders.refetch();
      }
      if (args !== skipToken) {
        search.refetch();
      }
    },
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
  const { uids, rows, loading, error } = useStarredSearch(STARRED_NAV_CAP);

  // Initialized from the search so a remount with a warm RTK cache doesn't flash a loading state: the nav tree is
  // already correct from the prior sync.
  const [hasSynced, setHasSynced] = useState(rows !== undefined);

  useEffect(() => {
    if (!uids || !rows) {
      return;
    }
    const items: StarredNavItem[] = rows.map((row) => ({
      id: row.uid,
      title: row.name,
      url: row.url,
      icon: foldersEnabled ? getIconForKind(row.kind) : undefined,
      sortWeight: row.kind === 'folder' ? STARRED_FOLDER_SORT_WEIGHT : undefined,
    }));
    dispatch(setStarredItems({ uids, items }));
    setHasSynced(true);
  }, [uids, rows, foldersEnabled]);

  // A failed search resolves loading too, rather than spinning forever.
  return { isLoading: loading || (!hasSynced && !error), isError: error };
};
