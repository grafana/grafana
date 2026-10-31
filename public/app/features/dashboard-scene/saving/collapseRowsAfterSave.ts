import { sceneGraph } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';
import { RowItem } from '../scene/layout-rows/RowItem';

/** Collapses the live rows after a "Collapse all rows" save, so they match what was saved */
export function collapseRowsAfterSave(dashboard: DashboardScene) {
  for (const row of sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof RowItem)) {
    // Same rule as the save: rows without a header are left as they are
    if (row instanceof RowItem && !row.state.hideHeader) {
      row.setCollapsedState(true);
    }
  }
}
