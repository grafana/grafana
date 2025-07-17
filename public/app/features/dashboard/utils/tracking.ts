import { VariableModel } from '@grafana/schema/dist/esm/index';
import { VariableKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { DashboardModel } from '../state/DashboardModel';

export function trackDashboardLoaded(dashboard: DashboardModel, duration?: number, versionBeforeMigration?: number) {
  // Count the different types of variables
  const variables = getV1SchemaVariables(dashboard.templating.list);
  // Count the different types of panels
  const panels = getPanelPluginCounts(dashboard.panels.map((p) => p.type));

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
  const trackingInformation = dashboard.getTrackingInformation();

  DashboardInteractions.dashboardInitialized({
    theme: undefined,
    duration,
    isScene: true,
    ...trackingInformation,
  });
}

export function getPanelPluginCounts(panels: string[] | string[]) {
  return panels.reduce((r: Record<string, number>, p) => {
    r[panelName(p)] = 1 + r[panelName(p)] || 1;
    return r;
  }, {});
}

export function getV1SchemaVariables(variableList: VariableModel[]) {
  return variableList
    .map((v) => v.type)
    .reduce((r: Record<string, number>, k) => {
      r[variableName(k)] = 1 + r[variableName(k)] || 1;
      return r;
    }, {});
}

function mapNewToOldTypes(type: VariableKind['kind']): VariableModel['type'] | undefined {
  switch (type) {
    case 'AdhocVariable':
      return 'adhoc';
    case 'CustomVariable':
      return 'custom';
    case 'QueryVariable':
      return 'query';
    case 'IntervalVariable':
      return 'interval';
    case 'ConstantVariable':
      return 'constant';
    case 'DatasourceVariable':
      return 'datasource';
    case 'TextVariable':
      return 'textbox';
    case 'GroupByVariable':
      return 'groupby';
    default:
      return undefined;
  }
}

export function getV2SchemaVariables(variableList: VariableKind[]) {
  return variableList
    .map((v) => mapNewToOldTypes(v.kind))
    .filter((v) => v !== undefined)
    .reduce((r: Record<string, number>, k) => {
      r[variableName(k)] = 1 + r[variableName(k)] || 1;
      return r;
    }, {});
}

export const variableName = (type: string) => `variable_type_${type}_count`;
const panelName = (type: string) => `panel_type_${type}_count`;
