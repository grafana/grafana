import { t } from '@grafana/i18n';
import { sceneGraph, sceneUtils } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { DashboardScene } from '../DashboardScene';

import { DashboardFiltersOverviewDrawer } from './DashboardFiltersOverviewDrawer';

interface Props {
  dashboard: DashboardScene;
}

export function DashboardFiltersOverviewPaneToggle({ dashboard }: Props) {
  const { variables } = sceneGraph.getVariables(dashboard)!.useState();
  const tooltip = t('dashboards.filters-overview.open', 'Open filters overview pane');

  const onClick = () => {
    dashboard.showModal(new DashboardFiltersOverviewDrawer({}));
  };

  const adHocVar = variables.find((v) => sceneUtils.isAdHocVariable(v));

  if (!adHocVar) {
    return null;
  }

  return (
    <ToolbarButton
      icon="filter"
      iconOnly={false}
      aria-label={tooltip}
      tooltip={tooltip}
      data-testid="filters-overview-expand"
      disabled={dashboard.state.isEditing}
      onClick={onClick}
      variant={'canvas'}
    >
      {t('dashboards.filters-overview.all-filters', 'All filters')}
    </ToolbarButton>
  );
}
