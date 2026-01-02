import { config } from '@grafana/runtime';
import { SceneDataProvider, SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema/dist/esm/index';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';

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

  dataProvider = new SceneQueryRunner({
    // If panel.datasource is not defined, we use the first datasource from the targets (queries)
    // This is to match the backend behavior when converting dashboard from V2 dashboard to V1
    // Also, SceneQueryRunner has the same logic
    datasource: panel.datasource ?? findFirstDatasource(panel.targets),
    queries: panel.targets,
    maxDataPoints: panel.maxDataPoints ?? undefined,
    maxDataPointsFromWidth: true,
    cacheTimeout: panel.cacheTimeout,
    queryCachingTTL: panel.queryCachingTTL,
    minInterval: panel.interval ?? undefined,
    dataLayerFilter: {
      panelId: panel.id,
    },
    $behaviors: [new DashboardDatasourceBehaviour({})],
  });

  // Wrap inner data provider in a data transformer
  return new SceneDataTransformer({
    $data: dataProvider,
    transformations: panel.transformations || [],
  });
}

function findFirstDatasource(targets: DataQuery[]): DataSourceRef | undefined {
  const datasource = targets.find((t) => t.datasource !== null)?.datasource;
  if (!datasource) {
    return undefined;
  }

  const dsRef: DataSourceRef = {
    ...(datasource?.type && { type: datasource?.type }),
    ...(datasource?.uid && { uid: datasource?.uid }),
  };

  return dsRef;
}
