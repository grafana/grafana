import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { type EditActionSource } from '../../scene/types/EditableDashboardElement';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { getLayoutManagerFor } from '../../utils/getLayoutManagerFor';
import { DashboardInteractions } from '../../utils/interactions';
import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import { endBatch, startBatch } from '../utils/batch';

export function removePanel(panel: VizPanel, source: EditActionSource) {
  DashboardInteractions.panelActionClicked('delete', getPanelIdForVizPanel(panel), source);
  getLayoutManagerFor(panel).removePanel?.(panel);
}

export function removePanels(dashboard: DashboardSceneLike, panels: VizPanel[], source: EditActionSource) {
  if (panels.length === 0) {
    return;
  }

  startBatch(
    dashboard,
    t('dashboard.edit-actions.remove-multiple', 'Remove {{typeName}} ({{num}})', {
      num: panels.length,
      typeName: t('dashboard.sidebar.elements.panels', 'Panels').toLowerCase(),
    }),
    { actionId: 'panel.remove', scope: 'multiple' }
  );

  try {
    panels.forEach((panel) => removePanel(panel, source));
  } finally {
    endBatch(dashboard);
  }
}
