import { useCallback } from 'react';

import { t } from '@grafana/i18n';

import { DashboardScene } from '../../scene/DashboardScene';
import { openAddVariablePane } from '../../settings/variables/VariableAddEditableElement';
import { DashboardInteractions } from '../../utils/interactions';

import { AddButton } from './AddButton';

export function AddVariable({ dashboardScene }: { dashboardScene: DashboardScene }) {
  const onAddVariableClick = useCallback(() => {
    openAddVariablePane(dashboardScene);
    DashboardInteractions.addVariableButtonClicked({ source: 'edit_pane' });
  }, [dashboardScene]);

  return (
    <AddButton
      icon="brackets-curly"
      label={t('dashboard-scene.add-variable.label-variable', 'Variable')}
      onClick={onAddVariableClick}
    />
  );
}
