import { Panel, VariableModel } from '@grafana/schema/dist/esm/index';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashboardModel } from '../state/DashboardModel';
import { PanelModel } from '../state/PanelModel';

export function trackDashboardLoaded(dashboard: DashboardModel, duration?: number, versionBeforeMigration?: number) {
  // Count the different types of variables
  const variables = getVariables(dashboard.templating.list);
  // Count the different types of panels
  const panels = getPanelCounts(dashboard.panels);

  DashboardInteractions.dashboardInitialized({
    uid: dashboard.uid,
    title: dashboard.title,
    theme: dashboard.style,
    schemaVersion: dashboard.schemaVersion,
    version_before_migration: versionBeforeMigration,
    panels_count: dashboard.panels.length,
    ...panels,
    ...variables,
    settings_nowdelay: dashboard.timepicker.nowDelay,
    settings_livenow: !!dashboard.liveNow,
    duration,
    isScene: false,
  });
}

export function trackDashboardSceneLoaded(dashboard: DashboardScene, duration?: number) {
  const initialSaveModel = dashboard.getInitialSaveModel();
  if (initialSaveModel) {
    const panels = getPanelCounts(initialSaveModel.panels || []);
    const variables = getVariables(initialSaveModel.templating?.list || []);
    DashboardInteractions.dashboardInitialized({
      uid: initialSaveModel.uid,
      title: initialSaveModel.title,
      theme: undefined,
      schemaVersion: initialSaveModel.schemaVersion,
      version_before_migration: initialSaveModel.version,
      panels_count: initialSaveModel.panels?.length || 0,
      ...panels,
      ...variables,
      settings_nowdelay: undefined,
      settings_livenow: !!initialSaveModel.liveNow,
      duration,
      isScene: true,
    });
  }
}

function getPanelCounts(panels: Panel[] | PanelModel[]) {
  return panels
    .map((p) => p.type)
    .reduce((r: Record<string, number>, p) => {
      r[panelName(p)] = 1 + r[panelName(p)] || 1;
      return r;
    }, {});
}

function getVariables(variableList: VariableModel[]) {
  return variableList
    .map((v) => v.type)
    .reduce((r: Record<string, number>, k) => {
      r[variableName(k)] = 1 + r[variableName(k)] || 1;
      return r;
    }, {});
}

const variableName = (type: string) => `variable_type_${type}_count`;
const panelName = (type: string) => `panel_type_${type}_count`;
