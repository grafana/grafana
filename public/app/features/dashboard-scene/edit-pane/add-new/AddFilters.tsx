import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { DashboardScene } from '../../scene/DashboardScene';
import { openAddFilterPane } from '../../settings/variables/FilterAddEditableElement';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export function AddFilters({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddFiltersClick = useCallback(() => {
    openAddFilterPane(dashboardScene);
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene]);

  return (
    <AddButton icon="filter" label={t('dashboard-scene.add-filters.label', 'Filters')} onClick={onAddFiltersClick} />
  );
}
