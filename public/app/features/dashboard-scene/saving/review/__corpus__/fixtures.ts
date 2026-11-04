import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { customVariable, dashboard, elements, grid, gridItem, gridOf, panel, row, rows } from './builders';

/*
 * Shared starting points. Each call builds a fresh spec with fixed panel ids, so a case can build its
 * baseline and derive its payload with `edit` without the two sides drifting apart.
 */

/**
 * One grid, read as: 'Requests' and 'Errors' side by side, 'Latency' below 'Requests'.
 */
export function gridDashboard(spec: Partial<DashboardV2Spec> = {}): DashboardV2Spec {
  return dashboard({
    elements: elements(
      ['panel-1', panel('Requests', { id: 1 })],
      ['panel-2', panel('Errors', { id: 2 })],
      ['panel-3', panel('Latency', { id: 3 })]
    ),
    layout: grid([
      gridItem('panel-1', { x: 0, y: 0, w: 12, h: 8 }),
      gridItem('panel-2', { x: 12, y: 0, w: 12, h: 8 }),
      gridItem('panel-3', { x: 0, y: 8, w: 12, h: 8 }),
    ]),
    ...spec,
  });
}

/**
 * Two rows: 'API' with 'Requests' and 'Errors', 'DB' with 'Queries' and 'Connections'; one `env` variable.
 */
export function rowsDashboard(spec: Partial<DashboardV2Spec> = {}): DashboardV2Spec {
  return dashboard({
    elements: elements(
      ['panel-1', panel('Requests', { id: 1 })],
      ['panel-2', panel('Errors', { id: 2 })],
      ['panel-3', panel('Queries', { id: 3 })],
      ['panel-4', panel('Connections', { id: 4 })]
    ),
    layout: rows([row('API', gridOf('panel-1', 'panel-2')), row('DB', gridOf('panel-3', 'panel-4'))]),
    variables: [customVariable('env', ['prod', 'staging'])],
    ...spec,
  });
}
