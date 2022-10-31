import { Dashboard, defaultDashboardCursorSync, Panel } from '@grafana/schema';

export function createDashboardJSON(dashboardInput: Partial<Dashboard> = {}): Dashboard {
  return {
    editable: true,
    graphTooltip: defaultDashboardCursorSync,
    schemaVersion: 36,
    style: 'dark',
    ...dashboardInput,
  };
}

export function createPanelJSON(panelInput: Partial<Panel> = {}): Panel {
  return {
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    options: {},
    repeatDirection: 'h',
    transformations: [],
    transparent: false,
    type: 'timeseries',
    ...panelInput,
  };
}
