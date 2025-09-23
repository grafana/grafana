import { config } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { explicitlyControlledMigrationPanels } from 'app/features/dashboard/state/PanelModel';
import { AngularDeprecationNotice } from 'app/features/plugins/angularDeprecation/AngularDeprecationNotice';

import { DashboardScene } from '../DashboardScene';

interface Props {
  dashboard: DashboardScene;
}

export const DashboardAngularDeprecationBanner = ({ dashboard }: Props) => {
  const panels = dashboard.getDashboardPanels();
  const shouldShowAutoMigrateLink = panels.some((panel) => {
    if (panel instanceof VizPanel) {
      return explicitlyControlledMigrationPanels.includes(panel.state.pluginId);
    }
    return false;
  });

  const isContainingAngularPanels =
    config.featureToggles.angularDeprecationUI && dashboard.hasDashboardAngularPlugins();

  return isContainingAngularPanels && dashboard.state.uid ? (
    <AngularDeprecationNotice
      dashboardUid={dashboard.state.uid}
      showAutoMigrateLink={shouldShowAutoMigrateLink}
      key={dashboard.state.uid}
    />
  ) : null;
};
