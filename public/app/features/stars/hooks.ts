import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { setStarredItems, type StarredNavItem } from 'app/core/reducers/navBarTree';
import { dispatch } from 'app/store/store';

import { useSearchStarredQuery } from './api';
import {
  findStarredKindBySearchKind,
  getStarredKinds,
  loadStarredKindsFor,
  starredNavEntry,
  subscribeStarredKinds,
} from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

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
 * The user's starred items of every kind Grafana shows, as search rows that follow the star set. The set is RTK
 * cache every star toggle invalidates and the search is keyed by it, so a toggle anywhere re-searches while the
 * previous rows stay up. `cap` bounds the uids searched, in uid order; without it the whole set is.
 */
export const useStarredSearch = (cap?: number) => {
  // Read during render so a flag flip or the app kinds loading, which change the kinds listed, re-runs the search
  const kinds = useSyncExternalStore(subscribeStarredKinds, getStarredKinds);
  const stars = useListStarsQuery({ fieldSelector: userStarsFieldSelector() });

  // App kinds are found once the stars hold one; their rows join the search when they are
  useEffect(() => {
    loadStarredKindsFor(stars.data);
  }, [stars.data]);

  // Sorted so the cache key is the set, not the order the API listed it in; deduped so a uid starred as several
  // kinds takes one cap slot.
  const searched = useMemo(() => {
    if (!stars.data) {
      return undefined;
    }
    const byKind = kinds.map((kind) => ({ kind, names: findStarredNames(stars.data, kind.group, kind.kind) }));
    const uids = [...new Set(byKind.flatMap(({ names }) => names))].sort().slice(0, cap);
    const inCap = new Set(uids);
    return {
      uids,
      args: byKind.flatMap(({ kind, names }) => {
        const searched = names.filter((name) => inCap.has(name)).sort();
        return searched.length > 0 ? [{ group: kind.group, kind: kind.kind, names: searched }] : [];
      }),
    };
  }, [stars.data, kinds, cap]);
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
 * Sync starred items into the nav tree on mount and when the star set changes.
 * Replaces whatever the backend shipped in bootData (which is empty in dual-writer mode 5).
 */
export const useSyncStarredItemsInNav = () => {
  const kinds = useSyncExternalStore(subscribeStarredKinds, getStarredKinds);
  const { uids, rows, loading, error } = useStarredSearch(STARRED_NAV_CAP);

  // Initialized from the search so a remount with a warm RTK cache doesn't flash a loading state: the nav tree is
  // already correct from the prior sync.
  const [hasSynced, setHasSynced] = useState(rows !== undefined);

  useEffect(() => {
    if (!uids || !rows) {
      return;
    }
    const items = rows.flatMap((row): StarredNavItem[] => {
      const kind = findStarredKindBySearchKind(row.kind);
      // The search row carries the slugged url, which the nav keeps over the kind's plain one
      return kind ? [{ ...starredNavEntry(kind, row.uid), id: row.uid, title: row.name, url: row.url }] : [];
    });
    dispatch(setStarredItems({ uids, items }));
    setHasSynced(true);
    // `kinds` decides the icons; the rows don't change when the flag flips
  }, [uids, rows, kinds]);

  // A failed search resolves loading too, rather than spinning forever.
  return { isLoading: loading || (!hasSynced && !error), isError: error };
};
