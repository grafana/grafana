import { type Spec as DashboardV2Spec } from '../../../../packages/grafana-schema/src/schema/dashboard/v2';

import { autoGrid, dashboardSpec, tab, tabsLayout, textPanels } from './builders';

/** Tabs "Tab 1" (P1, P2, P3), "Tab 2" (Q1) and "Tab 3" (R1), each an auto grid */
export function buildDashboardTabsWithPanelsSpec(grafanaVersion: string): DashboardV2Spec {
  const elements = textPanels(grafanaVersion, ['P1', 'P2', 'P3', 'Q1', 'R1']);

  return dashboardSpec(
    'Drag and drop: tabs with panels',
    elements,
    tabsLayout([
      tab('Tab 1', autoGrid(elements, ['P1', 'P2', 'P3'])),
      tab('Tab 2', autoGrid(elements, ['Q1'])),
      tab('Tab 3', autoGrid(elements, ['R1'])),
    ])
  );
}
