import { VizPanel } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

function getPanelDatasourceTypes(scene: DashboardScene): string[] {
  const types = new Set<string>();

  const panels = scene.state.body.getVizPanels();

  for (const child of panels) {
    const ts = panelDatasourceTypes(child);
    for (const t of ts) {
      types.add(t);
    }
  }

  return Array.from(types).sort();
}

function panelDatasourceTypes(vizPanel: VizPanel) {
  const types = new Set<string>();

  const queryRunner = getQueryRunnerFor(vizPanel);
  if (queryRunner) {
    for (const q of queryRunner.state.queries) {
      types.add(q.datasource?.type ?? '');
    }
  }

  return Array.from(types);
}

/**
 * Extract datasource types from dashboard panels for tracking purposes.
 * @returns Array of datasource type strings, or undefined if not available
 */
export function getDatasourceTypes(dashboard: DashboardScene): string[] | undefined {
  const datasourceTypes = getPanelDatasourceTypes(dashboard);
  return datasourceTypes.length > 0 ? datasourceTypes : undefined;
}
