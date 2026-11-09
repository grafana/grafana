import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { type NavModelItem } from '@grafana/data';
import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { ID_PREFIX } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { useSelector } from 'app/types/store';

import { useSearchStarredQuery } from './api';
import { STARRED_KINDS, findStarredKindBySearchKind } from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

/** Star or unstar the item with this id. Every starred view follows the `Stars` cache the mutation invalidates. */
export const useStarItem = (group: string, kind: string) => {
  const [addStar] = useAddStarMutation();
  const [removeStar] = useRemoveStarMutation();

  return async (id: string, newStarredState: boolean) => {
    const name = `user-${contextSrv.user.uid}`;
    const mutationArgs = { id, name, group, kind };
    try {
      if (newStarredState) {
        await addStar(mutationArgs).unwrap();
      } else {
        await removeStar(mutationArgs).unwrap();
      }
    } catch {
      // The mutation's own onQueryStarted reports the failure, and the star set keeps the value the server kept.
    }
  };
};

/**
 * Get starred items from the app platform API
 */
export const useStarredItems = (group: string, kind: string) => {
  const response = useListStarsQuery({ fieldSelector: userStarsFieldSelector() });

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
 * previous rows stay up. `cap` bounds the uids searched, in uid order; without it the whole set is. `skip` leaves
 * both requests unmade for a view that does not render stars.
 */
export const useStarredSearch = ({ cap, skip }: { cap?: number; skip?: boolean } = {}) => {
  const stars = useListStarsQuery(skip ? skipToken : { fieldSelector: userStarsFieldSelector() });

  // Sorted so the cache key is the set, not the order the API listed it in; deduped so a uid starred as several
  // kinds takes one cap slot.
  const searched = useMemo(() => {
    if (!stars.data) {
      return undefined;
    }
    const byKind = STARRED_KINDS.map((kind) => ({ kind, names: findStarredNames(stars.data, kind.group, kind.kind) }));
    const uids = [...new Set(byKind.flatMap(({ names }) => names))].sort().slice(0, cap);
    const inCap = new Set(uids);
    return {
      uids,
      args: byKind.flatMap(({ kind, names }) => {
        const searched = names.filter((name) => inCap.has(name)).sort();
        return searched.length > 0 ? [{ group: kind.group, kind: kind.kind, names: searched }] : [];
      }),
    };
  }, [stars.data, cap]);
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

// Created once, not per sort
const collator = new Intl.Collator();

/**
 * The nav tree with the Starred section's children derived from the stars query. The redux tree holds only the
 * empty section the backend ships, so every reader of the tree shows the same stars as the star buttons.
 */
export const useNavTreeWithStarred = (): {
  navTree: NavModelItem[];
  starredLoading: boolean;
  starredError: boolean;
} => {
  const navTree = useSelector((state) => state.navBarTree);
  const { rows, loading, error } = useStarredSearch({ cap: STARRED_NAV_CAP });

  const starredChildren = useMemo(() => {
    if (!rows) {
      return [];
    }
    return rows
      .flatMap((row): NavModelItem[] => {
        const kind = findStarredKindBySearchKind(row.kind);
        // A row nobody can star, or one whose kind has no nav entry, is not a starred item to show
        return kind
          ? [{ id: ID_PREFIX + row.uid, text: row.name, url: row.url, icon: kind.icon, sortWeight: kind.sortWeight }]
          : [];
      })
      .sort((a, b) => (a.sortWeight ?? 0) - (b.sortWeight ?? 0) || collator.compare(a.text, b.text));
  }, [rows]);

  const tree = useMemo(
    () => navTree.map((item) => (item.id === 'starred' ? { ...item, children: starredChildren } : item)),
    [navTree, starredChildren]
  );

  return { navTree: tree, starredLoading: loading, starredError: error };
};
