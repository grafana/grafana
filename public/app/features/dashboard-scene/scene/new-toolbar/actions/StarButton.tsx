import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Icon, ToolbarButton } from '@grafana/ui';

import { DashboardInteractions } from '../../../utils/interactions';
import { ToolbarActionProps } from '../types';

export const StarButton = ({ dashboard }: ToolbarActionProps) => {
  return (
    <ToolbarButton
      tooltip={
        dashboard.state.meta.isStarred
          ? t('dashboard.toolbar.new.unmark-favorite', 'Unmark as favorite')
          : t('dashboard.toolbar.new.mark-favorite', 'Mark as favorite')
      }
      icon={
        <Icon
          name={dashboard.state.meta.isStarred ? 'favorite' : 'star'}
          size="lg"
          type={dashboard.state.meta.isStarred ? 'mono' : 'default'}
        />
      }
      data-testid={selectors.components.NavToolbar.markAsFavorite}
      onClick={() => {
        DashboardInteractions.toolbarFavoritesClick();
        dashboard.onStarDashboard();
      }}
    />
  );
};
