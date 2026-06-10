import { skipToken } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useState } from 'react';

import {
  useGetStarsQuery as useLegacyGetStarsQuery,
  useStarDashboardByUidMutation as useLegacyStarDashboardMutation,
  useUnstarDashboardByUidMutation as useLegacyUnstarDashboardMutation,
} from '@grafana/api-clients/internal/rtkq/legacy/user';
import { locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { setStarred, setStarredItems, type StarredNavItem } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { dispatch } from 'app/store/store';

type StarItemArgs = {
  id: string;
  /** Title of the item - this is displayed in the nav */
  title: string;
};

/** Star or unstar an item */
export const useStarItem = (group: string, kind: string) => {
  const [addStar] = useAddStarMutation();
  const [removeStar] = useRemoveStarMutation();

  const [addStarLegacy] = useLegacyStarDashboardMutation();
  const [removeStarLegacy] = useLegacyUnstarDashboardMutation();

  const updateStarred = useUpdateNavStarredItems();

  if (config.featureToggles.starsFromAPIServer) {
    return async ({ id, title }: StarItemArgs, newStarredState: boolean) => {
      const name = `user-${contextSrv.user.uid}`;
      const mutationArgs = { id, name, group, kind };
      if (newStarredState) {
        await addStar(mutationArgs);
      } else {
        await removeStar(mutationArgs);
      }

      updateStarred({ id, title }, newStarredState);
    };
  }

  return async ({ id, title }: StarItemArgs, newStarredState: boolean) => {
    if (newStarredState) {
      await addStarLegacy({ dashboardUid: id });
    } else {
      await removeStarLegacy({ dashboardUid: id });
    }

    updateStarred({ id, title }, newStarredState);
  };
};

/**
 * Get starred items from legacy or app platform API
 */
export const useStarredItems = (group: string, kind: string) => {
  const name = `user-${contextSrv.user.uid}`;
  const appPlatform = config.featureToggles.starsFromAPIServer;
  const legacyResponse = useLegacyGetStarsQuery(appPlatform ? skipToken : undefined);
  const queryArgs = !appPlatform ? skipToken : { fieldSelector: `metadata.name=${name}` };
  const appPlatformResponse = useListStarsQuery(queryArgs);

  const appPlatformStarredItems = useMemo(() => {
    const { data, isLoading, isUninitialized } = appPlatformResponse;

    // If query hasn't been initiated yet or is still loading, return undefined to show loading state
    if (isUninitialized || isLoading) {
      return undefined;
    }

    // If query completed but no data, return empty array
    if (!data) {
      return [];
    }

    const starredItems = appPlatformResponse.data?.items || [];
    if (!starredItems.length) {
      return [];
    }

    return starredItems[0]?.spec.resource.find((info) => info.group === group && info.kind === kind)?.names || [];
  }, [appPlatformResponse, group, kind]);

  if (appPlatform) {
    return {
      ...appPlatformResponse,
      data: appPlatformStarredItems,
      // Ensure isLoading is true when data is undefined (still loading or uninitialized)
      isLoading: appPlatformStarredItems === undefined ? true : appPlatformResponse.isLoading,
    };
  }

  // For legacy response, ensure isLoading is true when query is uninitialized
  // RTK Query sets isLoading: false when uninitialized, but we need it to be true
  return {
    ...legacyResponse,
    isLoading: legacyResponse.isUninitialized || legacyResponse.isLoading,
  };
};

/**
 * Hook to update the nav menu with starred items
 */
export const useUpdateNavStarredItems = () => {
  return ({ id, title }: { id: string; title: string }, isStarred: boolean) => {
    const url = locationUtil.assureBaseUrl(`/d/${id}`);
    return dispatch(setStarred({ id, title, url, isStarred }));
  };
};

// Matches the backend cap on starred nav children in bootData (buildStarredItemsNavLinks)
const STARRED_NAV_CAP = 50;

/**
 * Sync starred dashboards into the nav tree on mount and when the star set changes.
 * Replaces whatever the backend shipped in bootData (which is empty in dual-writer mode 5).
 */
export const useSyncStarredItemsInNav = () => {
  const { data: uids, isLoading } = useStarredItems('dashboard.grafana.app', 'Dashboard');
  // Initialized from the stars query so a remount with a warm RTK cache doesn't
  // flash a loading state — the nav tree is already correct from the prior sync
  const [hasSynced, setHasSynced] = useState(!isLoading);

  // Stable identity so the effect doesn't re-fire when the array ref changes but content is identical
  const uidKey = useMemo(() => {
    if (!uids) {
      return undefined;
    }
    return [...uids].sort().join(',');
  }, [uids]);

  useEffect(() => {
    if (isLoading || uidKey === undefined) {
      return;
    }

    if (uidKey === '') {
      dispatch(setStarredItems({ uids: [], items: [] }));
      setHasSynced(true);
      return;
    }

    const names = uidKey.split(',').slice(0, STARRED_NAV_CAP);
    let cancelled = false;

    getGrafanaSearcher()
      .search({ name: names, kind: ['dashboard'] })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const items: StarredNavItem[] = [];
        for (let i = 0; i < response.view.length; i++) {
          const row = response.view.get(i);
          items.push({ id: row.uid, title: row.name, url: row.url });
        }
        dispatch(setStarredItems({ uids: names, items }));
        setHasSynced(true);
      })
      .catch((err) => {
        console.error('Failed to sync starred items to nav', err);
        // Fall back to the empty message rather than showing a loading state forever
        setHasSynced(true);
      });

    return () => {
      cancelled = true;
    };
  }, [uidKey, isLoading]);

  return { isLoading: isLoading || !hasSynced };
};
