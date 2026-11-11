import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { useDispatch, useSelector } from 'app/types/store';

import { refetchStarred, useSearchStarredQuery } from './api';
import { selectStarredKinds, starsHoldAppKind, useDiscoverAppKindsQuery } from './kinds';
import { findStarredNames, userStarsFieldSelector } from './utils';

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
 * previous rows stay up. Every caller shares one cache entry per star set; a view cuts the rows it shows after
 * sorting them. `skip` leaves both requests unmade for a view that does not render stars;
 * `refetchOnMountOrArgChange` searches again on each mount, for a view that must not show rows renamed or
 * deleted from another tab. `refetch` re-runs both requests; it is stable, so a view can call it from an effect on
 * its own refresh schedule.
 */
export const useStarredSearch = ({
  skip,
  refetchOnMountOrArgChange,
}: { skip?: boolean; refetchOnMountOrArgChange?: boolean } = {}) => {
  const stars = useListStarsQuery(skip ? skipToken : { fieldSelector: userStarsFieldSelector() });
  // App kinds are discovered once the stars hold one, and the search waits for them so it runs once, over every kind
  const needsAppKinds = starsHoldAppKind(stars.data);
  const appKinds = useDiscoverAppKindsQuery(needsAppKinds ? undefined : skipToken);
  const kindsSettled = !needsAppKinds || appKinds.isSuccess || appKinds.isError;
  const kinds = useSelector(selectStarredKinds);

  // Names sorted, so the cache key is the set and not the order the API listed it in
  const args = useMemo(() => {
    if (!stars.data || !kindsSettled) {
      return undefined;
    }
    return kinds.flatMap(({ group, kind }) => {
      const names = [...findStarredNames(stars.data, group, kind)].sort();
      return names.length > 0 ? [{ group, kind, names }] : [];
    });
  }, [stars.data, kinds, kindsSettled]);
  const search = useSearchStarredQuery(args ?? skipToken, { refetchOnMountOrArgChange });
  const dispatch = useDispatch();
  const refetch = useCallback(() => dispatch(refetchStarred()), [dispatch]);

  return {
    rows: search.data,
    // Until the first rows land; a changed star set keeps the previous rows up while it loads.
    loading: stars.isLoading || appKinds.isLoading || search.isLoading,
    // A failed discovery is not one: the dashboards and folders still list
    error: stars.isError || search.isError,
    refetch,
  };
};
