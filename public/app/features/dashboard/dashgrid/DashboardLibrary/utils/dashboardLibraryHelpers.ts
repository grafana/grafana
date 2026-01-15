import { locationService } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { CONTENT_KINDS } from '../interactions';

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
 * Extract datasource types from URL parameters or dashboard panels based on the content kind.
 * Supports two formats:
 * - datasourceTypes: JSON array of datasource types (for community dashboards)
 * - pluginId: Single datasource type (legacy format for provisioned dashboards)
 *
 * @returns Array of datasource type strings, or undefined if not available
 */
export function getDatasourceTypes(dashboard: DashboardScene): string[] | undefined {
  const params = locationService.getSearchObject();
  const datasourceTypesParam = params.datasourceTypes;
  const pluginIdParam = params.pluginId;
  const contentKind = params.contentKind;

  switch (contentKind) {
    case CONTENT_KINDS.COMMUNITY_DASHBOARD: {
      if (datasourceTypesParam && typeof datasourceTypesParam === 'string') {
        try {
          return JSON.parse(datasourceTypesParam);
        } catch {
          // If parsing fails, return undefined
          return undefined;
        }
      }
      return undefined;
    }
    case CONTENT_KINDS.DATASOURCE_DASHBOARD:
      return pluginIdParam && typeof pluginIdParam === 'string' ? [pluginIdParam] : undefined;
    case CONTENT_KINDS.TEMPLATE_DASHBOARD: {
      const datasourceTypes = getPanelDatasourceTypes(dashboard);
      return datasourceTypes.length > 0 ? datasourceTypes : undefined;
    }
    default:
      return undefined;
  }
}
