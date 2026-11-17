import { type Spec as DashboardV2Spec } from '../../../../packages/grafana-schema/src/schema/dashboard/v2';

import { autoGrid, dashboardSpec, row, rowsLayout, tab, tabsLayout, textPanels } from './builders';

/**
 * Tabs "Source" (rows "Row A" with A1, A2, "Row B" with B1, "Row C" with C1), "Rows target"
 * ("Row T" with T1), "Empty" (an empty auto grid) and "Grid" (an auto grid with G1, G2)
 */
export function buildDashboardTabsWithRowsSpec(grafanaVersion: string): DashboardV2Spec {
  const elements = textPanels(grafanaVersion, ['A1', 'A2', 'B1', 'C1', 'T1', 'G1', 'G2']);

  return dashboardSpec(
    'Drag and drop: tabs with rows',
    elements,
    tabsLayout([
      tab(
        'Source',
        rowsLayout([
          row('Row A', autoGrid(elements, ['A1', 'A2'])),
          row('Row B', autoGrid(elements, ['B1'])),
          row('Row C', autoGrid(elements, ['C1'])),
        ])
      ),
      tab('Rows target', rowsLayout([row('Row T', autoGrid(elements, ['T1']))])),
      tab('Empty', autoGrid(elements, [])),
      tab('Grid', autoGrid(elements, ['G1', 'G2'])),
    ])
  );
}
