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
    const { data, isLoading, isUninitialized, isFetching, isSuccess, isError } = appPlatformResponse;

    // If query hasn't been initiated yet, return undefined to show loading state
    if (isUninitialized) {
      return undefined;
    }

    // If query is still loading (initial load), return undefined to show loading state
    if (isLoading) {
      return undefined;
    }

    // Helper function to extract starred items from data
    const extractStarredItems = (responseData: typeof data): string[] => {
      if (!responseData || !('items' in responseData)) {
        return [];
      }

      const items = Array.isArray(responseData.items) ? responseData.items : [];
      if (!items.length) {
        return [];
      }

      const firstItem = items[0];
      if (!firstItem || typeof firstItem !== 'object' || !('spec' in firstItem)) {
        return [];
      }

      const spec = firstItem.spec;
      if (!spec || typeof spec !== 'object' || !('resource' in spec)) {
        return [];
      }

      const resources = Array.isArray(spec.resource) ? spec.resource : [];
      const resourceInfo = resources.find((info: unknown) => {
        if (typeof info !== 'object' || info === null) {
          return false;
        }
        if (!('group' in info) || !('kind' in info)) {
          return false;
        }
        // TypeScript knows info has 'group' and 'kind' properties at this point
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const groupValue = (info as { group: unknown }).group;
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const kindValue = (info as { kind: unknown }).kind;
        return groupValue === group && kindValue === kind;
      });

      if (resourceInfo && typeof resourceInfo === 'object' && resourceInfo !== null && 'names' in resourceInfo) {
        // TypeScript knows resourceInfo has 'names' property at this point
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const namesValue = (resourceInfo as { names: unknown }).names;
        return Array.isArray(namesValue) ? namesValue : [];
      }

      return [];
    };

    // If query completed successfully, process the data
    if (isSuccess && data) {
      return extractStarredItems(data);
    }

    // If query completed with error, return empty array
    if (isError) {
      return [];
    }

    // If query completed successfully but no data, return empty array
    if (isSuccess && !data) {
      return [];
    }

    // If we're still fetching but have cached data, use it
    // Otherwise, if fetching without cached data, show loading
    if (isFetching) {
      // If we have data from a previous fetch, use it
      if (data) {
        return extractStarredItems(data);
      }
      // No cached data and still fetching - show loading
      return undefined;
    }

    // Fallback: if we have data, use it
    if (data) {
      return extractStarredItems(data);
    }

    // Default: no data available, return empty array
    return [];
  }, [appPlatformResponse, group, kind]);

  // Determine loading state: true if we don't have processed data yet
  // This ensures the component shows loading spinner until we have actual data to display
  // Key fix: when query is uninitialized, RTK Query's isLoading is false, but we need it to be true
  const isLoadingState = appPlatformStarredItems === undefined || appPlatformResponse.isUninitialized;

  if (appPlatform) {
    return {
      ...appPlatformResponse,
      data: appPlatformStarredItems,
      // Override isLoading to be true when we don't have processed data OR when query is uninitialized
      // This is the key fix: even if RTK Query says isLoading: false (which it does when uninitialized),
      // if we don't have data to show, we should still show loading
      isLoading: isLoadingState,
      // Also ensure isFetching doesn't interfere - if uninitialized, we're effectively "fetching"
      isFetching: isLoadingState ? true : appPlatformResponse.isFetching,
    };
  }

  // For legacy response, handle loading state properly
  // Legacy query returns string[] directly, so if we have data or the query completed, we're not loading
  // Only show loading if query is uninitialized, actively loading, or fetching without data
  const legacyIsLoading =
    legacyResponse.isUninitialized || legacyResponse.isLoading || (legacyResponse.isFetching && !legacyResponse.data);

  return {
    ...legacyResponse,
    isLoading: legacyIsLoading,
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
