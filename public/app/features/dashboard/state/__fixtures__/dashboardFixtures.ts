import { Dashboard, defaultDashboardCursorSync, Panel } from '@grafana/schema';

export function createDashboardFixture(dashboardInput: Partial<Dashboard> = {}): Dashboard {
  return {
    editable: true,
    graphTooltip: defaultDashboardCursorSync,
    schemaVersion: 36,
    revision: 1,
    style: 'dark',
    ...dashboardInput,
  };
}

export function createPanelFixture(panelInput: Partial<Panel> = {}): Panel {
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
