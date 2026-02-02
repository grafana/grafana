import { dateTime, LoadingState } from '@grafana/data';
import { config } from '@grafana/runtime';
import { QueryRunnerState, SceneDataProvider, SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';

import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';

import { isOpenEmptyPanelsEnabled } from './utils';

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

  // BMC Code: Change Starts
  const dataProviderState: QueryRunnerState = {
    datasource: panel.datasource ?? undefined,
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
  };
  if (isOpenEmptyPanelsEnabled() && !isSnapshotPanel(panel)) {
    dataProviderState.runQueriesMode = 'manual';
    dataProviderState._hasFetchedData = true; // Assume data has been fetched to avoid unnecessary queries
    dataProviderState.data = {
      state: LoadingState.RefreshToLoad,
      series: [],
      timeRange: {
        from: dateTime(new Date()),
        to: dateTime(new Date()),
        raw: {
          from: 'now',
          to: 'now',
        },
      },
    };
  }
  dataProvider = new SceneQueryRunner(dataProviderState);
  // BMC Code: Change Ends

  // Wrap inner data provider in a data transformer
  return new SceneDataTransformer({
    $data: dataProvider,
    transformations: panel.transformations || [],
  });
}

const isSnapshotPanel = (panel: PanelModel) => {
  return panel.snapshotData || panel.targets.find((target) => target.snapshot);
};
