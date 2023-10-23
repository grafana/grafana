import React from 'react';
import { useAsync } from 'react-use';

import { DataSourceWithBackend } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneDataTransformer,
  SceneGridItem,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { CreatePublicDashboard as CreatePublicDashboardComponent } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/CreatePublicDashboard/CreatePublicDashboard';
import { supportedDatasources } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SupportedPubdashDatasources';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';

import { DashboardScene } from '../../scene/DashboardScene';
import { LibraryVizPanel } from '../../scene/LibraryVizPanel';
import { PanelRepeaterGridItem } from '../../scene/PanelRepeaterGridItem';

import { SharePublicDashboardTab } from './SharePublicDashboardTab';

export function CreatePublicDashboard({ model }: SceneComponentProps<SharePublicDashboardTab>) {
  const { isSaveLoading: isLoading, dashboardRef } = model.useState();

  const dashboard = dashboardRef.resolve();
  const { value: unsupportedDataSources } = useAsync(async () => {
    const types = getPanelTypes(dashboard);
    return getUnsupportedDashboardDatasources(types);
  }, []);

  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;

  return (
    <CreatePublicDashboardComponent
      onCreate={model.onCreate}
      isLoading={isLoading}
      unsupportedDatasources={unsupportedDataSources}
      unsupportedTemplateVariables={hasTemplateVariables}
    />
  );
}

function getPanelTypes(scene: DashboardScene): string[] {
  const types = new Set<string>();

  const body = scene.state.body;
  if (!(body instanceof SceneGridLayout)) {
    return [];
  }

  for (const child of body.state.children) {
    if (child instanceof SceneGridItem) {
      const ts = panelTypes(child);
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

export function panelTypes(gridItem: SceneGridItemLike) {
  let vizPanel: VizPanel | undefined;
  if (gridItem instanceof SceneGridItem) {
    if (gridItem.state.body instanceof LibraryVizPanel) {
      vizPanel = gridItem.state.body.state.panel;
    } else if (gridItem.state.body instanceof VizPanel) {
      vizPanel = gridItem.state.body;
    } else {
      throw new Error('SceneGridItem body expected to be VizPanel');
    }
  } else if (gridItem instanceof PanelRepeaterGridItem) {
    vizPanel = gridItem.state.source;
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

function rowTypes(gridRow: SceneGridRow) {
  const types = new Set(gridRow.state.children.map((c) => panelTypes(c)).flat());
  return types;
}

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
