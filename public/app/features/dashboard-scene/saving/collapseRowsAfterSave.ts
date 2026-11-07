import { sceneGraph } from '@grafana/scenes';
import { isDashboardV2Spec } from 'app/features/dashboard/api/utils';

import { type DashboardScene } from '../scene/DashboardScene';
import { RowItem } from '../scene/layout-rows/RowItem';

import { applyRowCollapseV2 } from './getDashboardChanges';

/** Collapses the live rows after a "Collapse all rows" save, so they match what was saved */
export function collapseRowsAfterSave(dashboard: DashboardScene) {
  for (const row of sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof RowItem)) {
    // Same rule as the save: rows without a header are left as they are
    if (row instanceof RowItem && !row.state.hideHeader) {
      row.setCollapsedState(true);
    }
  }

  // An open JSON Model editor feeds the next save, so its copy has to match as well
  const edited = dashboard.getRawJsonFromEditor();
  if (edited && isDashboardV2Spec(edited)) {
    applyRowCollapseV2(edited.layout, true);
    dashboard.state.editview?.setEditedSaveModel?.(edited);
  }
}
