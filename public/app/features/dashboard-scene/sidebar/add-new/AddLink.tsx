import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { openAddLinkPane } from '../../settings/links/LinkAddEditableElement';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export function AddLink({ dashboardScene }: { dashboardScene: DashboardSceneLike }) {
  const onAddLinkClick = useCallback(() => {
    openAddLinkPane(dashboardScene);
    DashboardInteractions.addLinkButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene]);

  return (
    <AddButton
      icon="link"
      label={t('dashboard.sidebar.add.link.label', 'Link')}
      tooltip={t('dashboard.sidebar.add.link.tooltip', 'Add link to another dashboard or external site')}
      onClick={onAddLinkClick}
    />
  );
}
