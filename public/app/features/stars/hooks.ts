import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { useDispatch } from 'app/types/store';

import { refetchStarred, useSearchStarredQuery } from './api';
import { refetchStarredAppKinds, useSearchStarredAppKindsQuery } from './kindSearch';
import { getStarredAppKinds, STARRED_INDEX_KINDS, type StarredKind } from './kinds';
import { canUseStars, findStarredNames, userStarsFieldSelector } from './utils';

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
  const canStar = canUseStars();
  const response = useListStarsQuery(canStar ? { fieldSelector: userStarsFieldSelector() } : skipToken);

  // Keyed on the response data, not the response: a refetch that returns the same stars keeps the same array.
  const { data, isLoading, isUninitialized } = response;
  const starredItems = useMemo(() => {
    // A user without a stars resource has nothing starred
    if (!canStar) {
      return [];
    }

    // If query hasn't been initiated yet or is still loading, return undefined to show loading state
    if (isUninitialized || isLoading) {
      return undefined;
    }

    // If query completed but no data, return empty array
    if (!data) {
      return [];
    }

    return findStarredNames(data, group, kind);
  }, [canStar, data, isLoading, isUninitialized, group, kind]);

  return {
    ...response,
    data: starredItems,
    // Ensure isLoading is true when data is undefined (still loading or uninitialized)
    isLoading: starredItems === undefined ? true : response.isLoading,
  };
};

/** The settled rows of a user without a stars resource; one array, so views keyed on the rows keep their memos */
const NO_STARRED_ROWS: DashboardQueryResult[] = [];

// Created once, not per sort
const collator = new Intl.Collator();

/**
 * The star set as the argument of a starred search: the starred names of each of `kinds` that has any, by search
 * kind. Names are sorted, so the argument is the set and not the order the API listed it in. Undefined until the
 * set is read, which `skip` and a user without a stars resource never do.
 */
const useStarredNames = (kinds: readonly StarredKind[], skip = false) => {
  const stars = useListStarsQuery(skip || !canUseStars() ? skipToken : { fieldSelector: userStarsFieldSelector() });
  const names = useMemo(
    () =>
      stars.data &&
      kinds.flatMap(({ group, kind, searchKind }) => {
        const starred = [...findStarredNames(stars.data, group, kind)].sort();
        return starred.length > 0 ? [{ kind: searchKind, names: starred }] : [];
      }),
    [stars.data, kinds]
  );
  return { stars, names };
};

/**
 * The user's starred dashboards and folders, as search rows that follow the star set. The set is RTK
 * cache every star toggle invalidates and the search is keyed by it, so a toggle anywhere re-searches while the
 * previous rows stay up. Every caller shares one cache entry per star set; a view cuts the rows it shows after
 * sorting them. `skip` leaves both requests unmade for a view that does not render stars, and a user without a
 * stars resource never makes them; `refetchOnMountOrArgChange` searches again on each mount, for a view that must
 * not show rows renamed or deleted from another tab. `refetch` re-runs both requests; it is stable, so a view can
 * call it from an effect on its own refresh schedule.
 */
export const useStarredDashboardsAndFolders = ({
  skip,
  refetchOnMountOrArgChange,
}: { skip?: boolean; refetchOnMountOrArgChange?: boolean } = {}) => {
  const canStar = canUseStars();
  const { stars, names } = useStarredNames(STARRED_INDEX_KINDS, skip);
  const search = useSearchStarredQuery(names ?? skipToken, { refetchOnMountOrArgChange });
  const dispatch = useDispatch();
  const refetch = useCallback(() => dispatch(refetchStarred()), [dispatch]);

  return {
    // A user without a stars resource has nothing starred: settled and empty, not waiting on a request never made
    rows: !skip && !canStar ? NO_STARRED_ROWS : search.data,
    // Until the first rows land; a changed star set keeps the previous rows up while it loads.
    loading: stars.isLoading || search.isLoading,
    error: stars.isError || search.isError,
    refetch,
  };
};

/**
 * Every starred object Grafana shows, as one list in title order: the starred dashboards and folders, with the
 * starred objects of app kinds added. The app rows are searched apart, each kind through its plugin's API; a view
 * of dashboards or folders alone has `useStarredDashboardsAndFolders`, which asks no plugin. Neither search waits
 * for the other: `rows` holds what has answered so far. With `error` set the search of the dashboards and folders
 * failed, so the rows are not all of the stars. A kind whose plugin cannot be searched is left out, not reported
 * as an error.
 */
export const useStarredSearch = ({ refetchOnMountOrArgChange }: { refetchOnMountOrArgChange?: boolean } = {}) => {
  const indexed = useStarredDashboardsAndFolders({ refetchOnMountOrArgChange });
  // A set without an app object is searched too, with no request: its empty rows replace those of the set before
  const { names } = useStarredNames(getStarredAppKinds());
  const apps = useSearchStarredAppKindsQuery(names ?? skipToken, { refetchOnMountOrArgChange });

  const rows = useMemo(() => {
    if (!apps.data?.length) {
      return indexed.rows;
    }
    // Each search answers in its own order; sorted together, every kind reads as one list
    return [...(indexed.rows ?? []), ...apps.data].sort((a, b) => collator.compare(a.name, b.name));
  }, [indexed.rows, apps.data]);
  const dispatch = useDispatch();
  const { refetch: refetchIndexed } = indexed;
  const refetch = useCallback(() => {
    refetchIndexed();
    dispatch(refetchStarredAppKinds());
  }, [refetchIndexed, dispatch]);

  return {
    rows,
    // Until there is a row to show or both searches have answered
    loading: !rows?.length && (indexed.loading || apps.isLoading),
    error: indexed.error,
    refetch,
  };
};
