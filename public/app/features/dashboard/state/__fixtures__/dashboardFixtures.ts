import { type Dashboard, defaultDashboardCursorSync, type Panel, type RowPanel } from '@grafana/schema';
import { type GetVariables } from 'app/features/variables/state/selectors';
import { type DashboardMeta } from 'app/types/dashboard';

import { DashboardModel } from '../DashboardModel';

export function createDashboardModelFixture(
  dashboardInput: Partial<Dashboard> = {},
  meta?: DashboardMeta,
  getVariablesFromState?: GetVariables
): DashboardModel {
  const dashboardJson: Dashboard = {
    editable: true,
    graphTooltip: defaultDashboardCursorSync,
    schemaVersion: 1,
    version: 1,
    timezone: '',
    ...dashboardInput,
  };

  return new DashboardModel(dashboardJson, meta, { getVariablesFromState });
}

export function createPanelSaveModel(panelInput: Partial<Panel | RowPanel> = {}): Panel {
  return {
    type: 'timeseries',
    ...panelInput,
  };
}
