import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { type DashboardScene } from '../../scene/DashboardScene';
import { openAddLinkPane } from '../../settings/links/LinkAddEditableElement';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export function AddLink({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddLinkClick = useCallback(() => {
    openAddLinkPane(dashboardScene);
    DashboardInteractions.addLinkButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene]);

  return (
    <AddButton
      icon="link"
      label={t('dashboard-scene.add-link.label-link', 'Link')}
      tooltip={t('dashboard-scene.add-link.tooltip', 'Add link to another dashboard or external site')}
      onClick={onAddLinkClick}
    />
  );
}
