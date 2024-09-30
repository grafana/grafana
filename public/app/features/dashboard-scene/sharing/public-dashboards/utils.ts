import { DataSourceWithBackend } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { supportedDatasources } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SupportedPubdashDatasources';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { DashboardScene } from '../../scene/DashboardScene';
import { getQueryRunnerFor } from '../../utils/utils';

export const getUnsupportedDashboardDatasources = async (types: string[]): Promise<string[]> => {
  let unsupportedDS = new Set<string>();

  for (const type of types) {
    if (!supportedDatasources.has(type)) {
      unsupportedDS.add(type);
    } else {
      const ds = await getDatasourceSrv().get(type);
      if (!(ds instanceof DataSourceWithBackend)) {
        unsupportedDS.add(type);
      }
    }
  }

  return Array.from(unsupportedDS);
};

export function getPanelDatasourceTypes(scene: DashboardScene): string[] {
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
