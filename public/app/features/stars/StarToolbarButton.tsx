import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, ToolbarButton } from '@grafana/ui';
import { useAddStarMutation, useRemoveStarMutation, useListStarsQuery } from 'app/api/clients/preferences/v1alpha1';
import { contextSrv } from 'app/core/core';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashboardScene } from '../dashboard-scene/scene/DashboardScene';

const getStarTooltips = () => ({
  star: t('dashboard.toolbar.mark-favorite', 'Mark as favorite'),
  unstar: t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite'),
});

export type Props = {
  group: string;
  kind: string;
  dashboard: DashboardScene;
};

export function StarToolbarButtonApiServer({ group, kind, id }: Pick<Props, 'group' | 'kind'> & { id: string }) {
  const name = `user-${contextSrv.user.uid}`;
  const stars = useListStarsQuery({ fieldSelector: `metadata.name=${name}` });
  const [addStar] = useAddStarMutation();
  const [removeStar] = useRemoveStarMutation();

  const isStarred = useMemo(() => {
    const starredItems = stars.data?.items || [];
    if (!starredItems.length) {
      return false;
    }
    const matchingInfo = starredItems[0]?.spec.resource.find((info) => info.group === group && info.kind === kind);
    return matchingInfo ? matchingInfo.names.includes(id) : false;
  }, [stars.data?.items, id, group, kind]);

  const handleStarToggle = () => {
    const mutationArgs = { name, group, kind, id };
    if (isStarred) {
      removeStar(mutationArgs);
    } else {
      addStar(mutationArgs);
    }
  };

  // Do not render the icon until data is loaded to make sure correct icon is displayed
  if (stars.isLoading) {
    return null;
  }

  const tooltips = getStarTooltips();

  return (
    <ToolbarButton
      tooltip={isStarred ? tooltips.unstar : tooltips.star}
      icon={<Icon name={isStarred ? 'favorite' : 'star'} size="lg" type={isStarred ? 'mono' : 'default'} />}
      data-testid={selectors.components.NavToolbar.markAsFavorite}
      onClick={handleStarToggle}
    />
  );
}

function StarToolbarButtonLegacy({ dashboard }: { dashboard: Props['dashboard'] }) {
  const { meta } = dashboard.useState();
  const isStarred = Boolean(meta.isStarred);
  const tooltips = getStarTooltips();

  return (
    <ToolbarButton
      tooltip={isStarred ? tooltips.unstar : tooltips.star}
      icon={<Icon name={isStarred ? 'favorite' : 'star'} size="lg" type={isStarred ? 'mono' : 'default'} />}
      data-testid={selectors.components.NavToolbar.markAsFavorite}
      onClick={() => {
        DashboardInteractions.toolbarFavoritesClick();
        dashboard.onStarDashboard();
      }}
    />
  );
}

export function StarToolbarButton({ dashboard, group, kind }: Props) {
  const state = dashboard.useState();
  // In legacy storage dashboard uid is stored in state.uid
  const uid = state.meta.uid || state.uid;

  if (!contextSrv.user.uid || !uid?.length) {
    return null;
  }

  if (config.featureToggles.starsFromAPIServer) {
    return <StarToolbarButtonApiServer group={group} kind={kind} id={uid} />;
  }

  return <StarToolbarButtonLegacy dashboard={dashboard} />;
}
