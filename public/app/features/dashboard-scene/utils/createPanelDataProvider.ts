import { config } from '@grafana/runtime';
import { SceneDataProvider, SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { PanelModel } from 'app/features/dashboard/state';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';

import { ShareQueryDataProvider } from '../scene/ShareQueryDataProvider';

export function createPanelDataProvider(panel: PanelModel): SceneDataProvider | undefined {
  // Skip setting query runner for panels without queries
  if (!panel.targets?.length) {
    return undefined;
  }

  // Skip setting query runner for panel plugins with skipDataQuery
  if (config.panels[panel.type]?.skipDataQuery) {
    return undefined;
  }

  let dataProvider: SceneDataProvider | undefined = undefined;

  if (panel.datasource?.uid === SHARED_DASHBOARD_QUERY) {
    dataProvider = new ShareQueryDataProvider({ query: panel.targets[0] });
  } else {
    dataProvider = new SceneQueryRunner({
      queries: panel.targets,
      maxDataPoints: panel.maxDataPoints ?? undefined,
    });
  }

  // Wrap inner data provider in a data transformer
  if (panel.transformations?.length) {
    dataProvider = new SceneDataTransformer({
      $data: dataProvider,
      transformations: panel.transformations,
    });
  }

  return dataProvider;
}
