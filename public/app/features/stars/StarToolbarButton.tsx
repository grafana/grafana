import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, ToolbarButton } from '@grafana/ui';
import { useGetStarsQuery, useAddStarMutation, useRemoveStarMutation } from 'app/api/clients/preferences/v1alpha1';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

const getStarTooltips = () => ({
  star: t('dashboard.toolbar.mark-favorite', 'Mark as favorite'),
  unstar: t('dashboard.toolbar.unmark-favorite', 'Unmark as favorite'),
});

export type Props = {
  group: string;
  kind: string;
  dashboard: {
    onStarDashboard: () => void;
    state: {
      meta: {
        isStarred?: boolean;
        uid?: string;
      };
    };
  };
};

export function StarToolbarButtonApiServer({ group, kind, id }: { group: string; kind: string; id: string }) {
  const name = `user-${config.bootData.user.uid}`;
  const stars = useGetStarsQuery({ name });
  const [addStar] = useAddStarMutation();
  const [removeStar] = useRemoveStarMutation();

  const isStarred = useMemo(() => {
    if (stars.data?.spec.resource.length) {
      for (let info of stars.data?.spec.resource) {
        if (info.group === group && info.kind === kind) {
          return info.names.includes(id);
        }
      }
    }
    return false;
  }, [stars, group, kind, id]);

  const handleStarToggle = () => {
    const mutationArgs = { name, group, kind, id };
    if (isStarred) {
      removeStar(mutationArgs);
    } else {
      addStar(mutationArgs);
    }
  };

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
  const { meta } = dashboard.state;
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

export function StarToolbarButton(props: Props) {
  const uid = props.dashboard.state.meta.uid;

  if (!config.bootData.user.uid || !uid?.length) {
    return null;
  }

  if (config.featureToggles.starsFromAPIServer) {
    return <StarToolbarButtonApiServer group={props.group} kind={props.kind} id={uid} />;
  }

  return <StarToolbarButtonLegacy dashboard={props.dashboard} />;
}
