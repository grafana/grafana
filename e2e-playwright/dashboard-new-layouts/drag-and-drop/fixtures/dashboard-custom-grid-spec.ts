import { type Spec as DashboardV2Spec } from '../../../../packages/grafana-schema/src/schema/dashboard/v2';

import { dashboardSpec, elementRef, textPanels } from './builders';

/** Custom grid with two panels per line: "Panel one" and "Panel two", then "Panel three" and "Panel four" */
export function buildDashboardCustomGridSpec(grafanaVersion: string): DashboardV2Spec {
  const titles = ['Panel one', 'Panel two', 'Panel three', 'Panel four'];
  const elements = textPanels(grafanaVersion, titles);

  return dashboardSpec('Drag and drop: custom grid', elements, {
    kind: 'GridLayout',
    spec: {
      items: titles.map((title, index) => ({
        kind: 'GridLayoutItem',
        spec: {
          x: (index % 2) * 12,
          y: Math.floor(index / 2) * 8,
          width: 12,
          height: 8,
          element: elementRef(elements, title),
        },
      })),
    },
  });
}
