import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import {
  useGetStarsQuery as useLegacyGetStarsQuery,
  useStarDashboardByUidMutation as useLegacyStarDashboardMutation,
  useUnstarDashboardByUidMutation as useLegacyUnstarDashboardMutation,
} from '@grafana/api-clients/rtkq/legacy/user';
import { locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/collections/v1alpha1';
import { setStarred } from 'app/core/reducers/navBarTree';
import { contextSrv } from 'app/core/services/context_srv';
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
