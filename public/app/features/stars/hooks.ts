import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import {
  useGetStarsQuery as useLegacyGetStarsQuery,
  useStarDashboardByUidMutation as useLegacyStarDashboardMutation,
  useUnstarDashboardByUidMutation as useLegacyUnstarDashboardMutation,
} from '@grafana/api-clients/rtkq/legacy/user';
import { locationUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/preferences/v1alpha1';
import { contextSrv } from 'app/core/core';
import { setStarred } from 'app/core/reducers/navBarTree';
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
  const appPlatformResponse = useListStarsQuery(!appPlatform ? skipToken : { fieldSelector: `metadata.name=${name}` });

  const appPlatformStarredItems = useMemo(() => {
    const { data } = appPlatformResponse;
    if (data) {
      const starredItems = appPlatformResponse.data?.items || [];
      if (!starredItems.length) {
        return [];
      }
      return starredItems[0]?.spec.resource.find((info) => info.group === group && info.kind === kind)?.names || [];
    }
    return undefined;
  }, [appPlatformResponse, group, kind]);

  return appPlatform
    ? {
        ...appPlatformResponse,
        data: appPlatformStarredItems,
      }
    : legacyResponse;
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
