import { DataQueryError, DataQueryErrorType } from '@grafana/data';
import { config } from '@grafana/runtime';
import type { SceneDataQuery, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';
import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

export type DashboardPanelErrorSeverity = 'error' | 'warning';

export interface DashboardPanelErrorSummary {
  panelId: number;
  panelTitle: string;
  refId?: string;
  datasource?: string;
  message: string;
  severity: DashboardPanelErrorSeverity;
}

function assertDashboardV2Enabled() {
  const isKubernetesDashboardsEnabled = Boolean(config.featureToggles.kubernetesDashboards);
  const isV2Enabled = Boolean(config.featureToggles.kubernetesDashboardsV2 || config.featureToggles.dashboardNewLayouts);

  if (!isKubernetesDashboardsEnabled || !isV2Enabled) {
    throw new Error('V2 dashboard kinds API requires kubernetes dashboards v2 to be enabled');
  }
}

function getCurrentDashboardScene() {
  const mgr = getDashboardScenePageStateManager();
  const dashboard = mgr.state.dashboard;
  if (!dashboard) {
    throw new Error('No dashboard is currently open');
  }
  return dashboard;
}

function toMessage(err: DataQueryError): string {
  return err.message || err.data?.message || err.data?.error || 'Query error';
}

function toSeverity(err: DataQueryError): DashboardPanelErrorSeverity {
  // Treat cancellations as warnings; everything else is an error.
  if (err.type === DataQueryErrorType.Cancelled) {
    return 'warning';
  }
  return 'error';
}

function formatDatasourceRef(ds: unknown): string | undefined {
  if (!ds || typeof ds !== 'object') {
    return undefined;
  }
  const obj = ds as Record<string, unknown>;
  const uid = obj.uid;
  const name = obj.name;
  const type = obj.type;
  if (typeof uid === 'string' && uid.length) {
    return uid;
  }
  if (typeof name === 'string' && name.length) {
    return name;
  }
  if (typeof type === 'string' && type.length) {
    return type;
  }
  return undefined;
}

function getDatasourceForError(queryRunner: SceneQueryRunner, refId?: string): string | undefined {
  const queries = (queryRunner.state.queries ?? []) as SceneDataQuery[];
  const q = refId ? queries.find((qq) => qq.refId === refId) : undefined;
  const ds = q?.datasource ?? queryRunner.state.datasource;
  return formatDatasourceRef(ds);
}

export function getCurrentDashboardErrors(): DashboardPanelErrorSummary[] {
  assertDashboardV2Enabled();

  const dashboard = getCurrentDashboardScene();
  const panels = dashboardSceneGraph.getVizPanels(dashboard);

  const out: DashboardPanelErrorSummary[] = [];

  for (const panel of panels) {
    const queryRunner = getQueryRunnerFor(panel);
    const errors = queryRunner?.state.data?.errors ?? [];
    if (!queryRunner || errors.length === 0) {
      continue;
    }

    const panelId = getPanelIdForVizPanel(panel);
    const panelTitle = (panel as VizPanel).state.title ?? '';

    for (const err of errors) {
      const refId = err.refId;
      out.push({
        panelId,
        panelTitle,
        refId,
        datasource: getDatasourceForError(queryRunner, refId),
        message: toMessage(err),
        severity: toSeverity(err),
      });
    }
  }

  // Stable ordering for LLM consumption.
  out.sort((a, b) => {
    if (a.panelId !== b.panelId) {
      return a.panelId - b.panelId;
    }
    return (a.refId ?? '').localeCompare(b.refId ?? '');
  });

  return out;
}


