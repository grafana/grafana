import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';
import { isDashboardNewLayoutsEnabled } from 'app/features/dashboard/api/utils';

import { type DashboardScene } from '../../scene/DashboardScene';
import { edit } from '../utils/edit';

export function unlinkLibraryPanel(dashboard: DashboardScene, panel: VizPanel) {
  // Legacy layouts have no active sidebar to perform edit actions
  if (!isDashboardNewLayoutsEnabled()) {
    dashboard.unlinkLibraryPanel(panel);
    return;
  }

  const behaviorsBefore = panel.state.$behaviors;

  edit({
    meta: { actionId: 'panel.unlinkLibraryPanel' },
    description: t('dashboard.edit-actions.unlink-library-panel', 'Unlink library panel'),
    source: panel,
    perform: () => dashboard.unlinkLibraryPanel(panel),
    undo: () => panel.setState({ $behaviors: behaviorsBefore }),
  });
}
