import { DataSourceWithBackend } from '@grafana/runtime';
import {
  SceneGridItemLike,
  VizPanel,
  SceneQueryRunner,
  SceneDataTransformer,
  SceneGridLayout,
  SceneGridRow,
} from '@grafana/scenes';
import { supportedDatasources } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SupportedPubdashDatasources';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { DashboardGridItem } from '../../scene/DashboardGridItem';
import { DashboardScene } from '../../scene/DashboardScene';

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

  const body = scene.state.body;
  if (!(body instanceof SceneGridLayout)) {
    return [];
  }

  for (const child of body.state.children) {
    if (child instanceof DashboardGridItem) {
      const ts = panelDatasourceTypes(child);
      for (const t of ts) {
        types.add(t);
      }
    }

    if (child instanceof SceneGridRow) {
      const ts = rowTypes(child);
      for (const t of ts) {
        types.add(t);
      }
    }
  }

  return Array.from(types).sort();
}

function rowTypes(gridRow: SceneGridRow) {
  const types = new Set(gridRow.state.children.map((c) => panelDatasourceTypes(c)).flat());
  return types;
}

function panelDatasourceTypes(gridItem: SceneGridItemLike) {
  let vizPanel: VizPanel | undefined;

  if (gridItem instanceof DashboardGridItem) {
    if (gridItem.state.body instanceof VizPanel) {
      vizPanel = gridItem.state.body;
    } else {
      throw new Error('DashboardGridItem body expected to be VizPanel');
    }
  }

  if (!vizPanel) {
    throw new Error('Unsupported grid item type');
  }
  const dataProvider = vizPanel.state.$data;
  const types = new Set<string>();
  if (dataProvider instanceof SceneQueryRunner) {
    for (const q of dataProvider.state.queries) {
      types.add(q.datasource?.type ?? '');
    }
  }

  if (dataProvider instanceof SceneDataTransformer) {
    const panelData = dataProvider.state.$data;
    if (panelData instanceof SceneQueryRunner) {
      for (const q of panelData.state.queries) {
        types.add(q.datasource?.type ?? '');
      }
    }
  }

  return Array.from(types);
}
