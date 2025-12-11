import { VariableModel } from '@grafana/schema/dist/esm/index';
import {
  AdhocVariableKind,
  DatasourceVariableKind,
  QueryVariableKind,
  VariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2';
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

export function trackDashboardCreatedOrSaved(
  isNew: boolean | undefined,
  trackingProps: { name: string; url: string; uid: string; numPanels: number; numRows: number }
) {
  DashboardInteractions.dashboardCreatedOrSaved(isNew, trackingProps);
}

export function getPanelPluginCounts(panels: string[]) {
  return panels.reduce((r: Record<string, number>, p) => {
    r[panelName(p)] = 1 + r[panelName(p)] || 1;
    return r;
  }, {});
}

export function getV1SchemaVariables(variableList: VariableModel[]) {
  return {
    // Count variable types
    ...variableList.reduce<Record<string, number>>((variables, current) => {
      variables[variableName(current.type)] = 1 + (variables[variableName(current.type)] || 0);
      return variables;
    }, {}),
    // List of variables with data source types
    varsWithDataSource: variableList.reduce<Array<{ type: string; datasource: string }>>((variablesWithDs, current) => {
      if (current.datasource?.type) {
        variablesWithDs.push({
          type: current.type,
          datasource: current.datasource.type,
        });
      }
      return variablesWithDs;
    }, []),
  };
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
  return {
    // Count variable types
    ...variableList.reduce<Record<string, number>>((variables, current) => {
      const type = mapNewToOldTypes(current.kind);
      if (type) {
        variables[variableName(type)] = 1 + (variables[variableName(type)] || 0);
      }
      return variables;
    }, {}),
    // List of variables with data source types
    varsWithDataSource: variableList.reduce<Array<{ type: string; datasource: string }>>((variablesWithDs, current) => {
      let datasource = '';
      const type = mapNewToOldTypes(current.kind);
      datasource = getDatasourceFromVar(current);
      if (datasource && type) {
        variablesWithDs.push({ type, datasource });
      }
      return variablesWithDs;
    }, []),
  };
}

export const variableName = (type: string) => `variable_type_${type}_count`;
const panelName = (type: string) => `panel_type_${type}_count`;

const isAdhocVar: (v: VariableKind) => v is AdhocVariableKind = (v) => v.kind === 'AdhocVariable';
const isDatasourceVar: (v: VariableKind) => v is DatasourceVariableKind = (v) => v.kind === 'DatasourceVariable';
const isQueryVar: (v: VariableKind) => v is QueryVariableKind = (v) => v.kind === 'QueryVariable';

const getDatasourceFromVar = (v: VariableKind) =>
  isAdhocVar(v) ? v.group : isDatasourceVar(v) ? v.spec.pluginId : isQueryVar(v) ? v.spec?.query.group : '';
