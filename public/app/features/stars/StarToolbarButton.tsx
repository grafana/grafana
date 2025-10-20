import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { locationUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, ToolbarButton } from '@grafana/ui';
import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/preferences/v1alpha1';
import {
  useGetStarsQuery as useLegacyGetStarsQuery,
  useStarDashboardMutation as useLegacyStarDashboardMutation,
  useUnstarDashboardMutation as useLegacyUnstarDashboardMutation,
} from 'app/api/legacy/user/api';
import { updateNavIndex } from 'app/core/actions';
import { contextSrv } from 'app/core/core';
import { ID_PREFIX, setStarred } from 'app/core/reducers/navBarTree';
import { removeNavIndex } from 'app/core/reducers/navModel';
import { useDispatch, useSelector } from 'app/types/store';

const getStarTooltips = (title: string) => ({
  star: t('stars.mark-as-starred', 'Mark "{{title}}" as favorite', {
    title,
  }),
  unstar: t('stars.unmark-as-starred', 'Unmark "{{title}}" as favorite', {
    title,
  }),
});

type Props = {
  title: string;
  group: string;
  kind: string;
  id: string;
  onStarChange?: (id: string, isStarred: boolean) => void;
};

type StarItemArgs = {
  id: string;
  /** Title of the item - this is displayed in the nav */
  title: string;
};

/** Star or unstar an item */
const useStarItem = (group: string, kind: string) => {
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
      await addStarLegacy({ id });
    } else {
      await removeStarLegacy({ id });
    }

    updateStarred({ id, title }, newStarredState);
  };
};

/**
 * Get starred items from legacy or app platform API
 */
const useStarredItems = (group: string, kind: string) => {
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
 * Update the nav menu with starred items
 */
const useUpdateNavStarredItems = () => {
  const dispatch = useDispatch();
  const navIndex = useSelector((state) => state.navIndex);
  const { starred: starredNavItem } = navIndex;

  return function ({ id, title }: { id: string; title: string }, isStarred: boolean) {
    const url = locationUtil.assureBaseUrl(`/d/${id}`);
    dispatch(setStarred({ id, title, url, isStarred }));

    const navID = ID_PREFIX + id;

    if (isStarred) {
      starredNavItem.children?.push({
        id: navID,
        text: title,
        url: url ?? '',
        parentItem: starredNavItem,
      });
    } else {
      dispatch(removeNavIndex(navID));
      starredNavItem.children = starredNavItem.children?.filter((element) => element.id !== navID);
    }
    dispatch(updateNavIndex(starredNavItem));
  };
};

export function StarToolbarButton({ title, group, kind, id, onStarChange }: Props) {
  const tooltips = getStarTooltips(title);

  const handleItemStar = useStarItem(group, kind);

  const { data: stars, isLoading } = useStarredItems(group, kind);

  const isStarred = useMemo(() => {
    const starredItems = stars || [];

    return starredItems.includes(id);
  }, [id, stars]);

  const handleStarToggle = async () => {
    await handleItemStar({ id, title }, !isStarred);
    onStarChange?.(id, !isStarred);
  };

  const iconProps = (() => {
    if (isLoading) {
      return { name: 'spinner', type: 'default' } as const;
    }
    if (isStarred) {
      return { name: 'favorite', type: 'mono' } as const;
    }
    return { name: 'star', type: 'default' } as const;
  })();

  const tooltip = (() => {
    if (isLoading) {
      return undefined;
    }
    return isStarred ? tooltips.unstar : tooltips.star;
  })();

  const icon = <Icon {...iconProps} size="lg" />;
  return (
    <ToolbarButton
      disabled={isLoading}
      tooltip={tooltip}
      icon={icon}
      data-testid={selectors.components.NavToolbar.markAsFavorite}
      onClick={handleStarToggle}
    />
  );
}
