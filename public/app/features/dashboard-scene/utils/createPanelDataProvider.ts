import { getPanelPluginMetasMapSync, type PanelPluginMetas } from '@grafana/runtime/internal';
import { type SceneDataProvider, SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';

import { PanelDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';

import { findPanelPluginMeta } from './panelPluginMeta';
import { getEmptyQueryRunnerState, isDefaultQuery } from './queryRunnerState';

export function createPanelDataProvider(
  panel: PanelModel,
  panelMetas: PanelPluginMetas = getPanelPluginMetasMapSync()
): SceneDataProvider | undefined {
  const pluginMeta = findPanelPluginMeta(panelMetas, panel.type);

  let targets = panel.targets;
  if (pluginMeta?.skipDefaultQuery && panel.targets?.length === 1 && isDefaultQuery(panel.targets[0])) {
    targets = [];
  }

  // Skip setting query runner for panels without queries
  if (!targets?.length && !pluginMeta?.skipDefaultQuery) {
    return undefined;
  }

  // Skip setting query runner for panel plugins with skipDataQuery
  if (pluginMeta?.skipDataQuery) {
    return undefined;
  }

  let dataProvider: SceneDataProvider | undefined = undefined;

  dataProvider = new SceneQueryRunner({
    $data: new PanelDataLayerSet(),
    // If panel.datasource is not defined, we use the first datasource from the targets (queries)
    datasource: panel.datasource ?? findFirstDatasource(targets ?? []),
    ...(targets?.length ? { queries: targets } : getEmptyQueryRunnerState()),
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
  const datasource = targets.find((t) => Boolean(t.datasource))?.datasource;
  if (!datasource) {
    return undefined;
  }

  const dsRef: DataSourceRef = {
    ...(datasource?.type && { type: datasource?.type }),
    ...(datasource?.uid && { uid: datasource?.uid }),
  };

  return dsRef;
}
