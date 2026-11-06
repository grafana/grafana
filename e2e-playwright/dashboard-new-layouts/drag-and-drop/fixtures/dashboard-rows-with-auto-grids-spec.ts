import { type Spec as DashboardV2Spec } from '../../../../packages/grafana-schema/src/schema/dashboard/v2';

import { autoGrid, dashboardSpec, row, rowsLayout, textPanels } from './builders';

/** Rows "Row A" (A1, A2), "Row B" (B1, B2) and "Row C" (C1, collapsed), each an auto grid */
export function buildDashboardRowsWithAutoGridsSpec(grafanaVersion: string): DashboardV2Spec {
  const elements = textPanels(grafanaVersion, ['A1', 'A2', 'B1', 'B2', 'C1']);

  return dashboardSpec(
    'Drag and drop: rows with auto grids',
    elements,
    rowsLayout([
      row('Row A', autoGrid(elements, ['A1', 'A2'])),
      row('Row B', autoGrid(elements, ['B1', 'B2'])),
      row('Row C', autoGrid(elements, ['C1']), { collapse: true }),
    ])
  );
}
