import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import { API_GROUP as DASHBOARD_API_GROUP } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { API_GROUP as FOLDER_API_GROUP } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { locationUtil } from '@grafana/data';
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

/**
 * Icon and sort rank of a nav Starred entry by item kind. Icons only once folders can be starred too: that's when
 * kinds need telling apart.
 */
function starredNavDecoration(kind: string): Pick<StarredNavItem, 'icon' | 'sortWeight'> {
  return {
    icon: starredFoldersEnabled() ? getIconForKind(kind) : undefined,
    sortWeight: kind === 'folder' ? STARRED_FOLDER_SORT_WEIGHT : undefined,
  };
}

/** Nav Starred entry (url + icon + sort rank) for a starred item, or undefined when this kind isn't shown in the nav. */
function starredNavEntry(group: string, kind: string, id: string): Omit<StarredNavItem, 'id' | 'title'> | undefined {
  if (group === DASHBOARD_API_GROUP && kind === 'Dashboard') {
    return { url: locationUtil.assureBaseUrl(`/d/${id}`), ...starredNavDecoration('dashboard') };
  }
  if (group === FOLDER_API_GROUP && kind === 'Folder' && starredFoldersEnabled()) {
    return { url: getFolderURL(id), ...starredNavDecoration('folder') };
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
      dispatch(setStarred({ id, title, ...entry, isStarred: newStarredState }));
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
 * while the previous rows stay up. `cap` bounds the uids searched, in uid order; without it the whole set is.
 */
export const useStarredSearch = (cap?: number) => {
  const foldersEnabled = starredFoldersEnabled();
  const stars = useListStarsQuery({ fieldSelector: userStarsFieldSelector() });

  // Sorted so the cache key is the set, not the order the API listed it in; deduped so a uid starred as both kinds
  // takes one cap slot.
  const searched = useMemo(() => {
    if (!stars.data) {
      return undefined;
    }
    const dashboards = findStarredNames(stars.data, DASHBOARD_API_GROUP, 'Dashboard');
    const folders = foldersEnabled ? findStarredNames(stars.data, FOLDER_API_GROUP, 'Folder') : [];
    const uids = [...new Set([...dashboards, ...folders])].sort().slice(0, cap);
    const inCap = new Set(uids);
    return {
      uids,
      args: {
        dashboards: dashboards.filter((uid) => inCap.has(uid)).sort(),
        folders: folders.filter((uid) => inCap.has(uid)).sort(),
      },
    };
  }, [stars.data, foldersEnabled, cap]);
  // Refetched on every mount so an unchanged set still picks up renamed or deleted items.
  const search = useSearchStarredQuery(searched?.args ?? skipToken, { refetchOnMountOrArgChange: true });

  return {
    uids: searched?.uids,
    rows: search.data,
    // Until the first rows land; a changed star set keeps the previous rows up while it loads.
    loading: stars.isLoading || search.isLoading,
    error: stars.isError || search.isError,
    retry: () => {
      stars.refetch();
      if (searched) {
        search.refetch();
      }
    },
  };
};

// Bounds the nav section and the uid list its search request carries
const STARRED_NAV_CAP = 50;

/**
 * Sync starred dashboards into the nav tree on mount and when the star set changes.
 * Replaces whatever the backend shipped in bootData (which is empty in dual-writer mode 5).
 */
export const useSyncStarredItemsInNav = () => {
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
      ...starredNavDecoration(row.kind),
    }));
    dispatch(setStarredItems({ uids, items }));
    setHasSynced(true);
  }, [uids, rows]);

  // A failed search resolves loading too, rather than spinning forever.
  return { isLoading: loading || (!hasSynced && !error), isError: error };
};
