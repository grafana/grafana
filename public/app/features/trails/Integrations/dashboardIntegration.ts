import { DataSourceApi, PanelMenuItem } from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { getDataSourceSrv } from '@grafana/runtime';
import { SceneTimeRangeState, VizPanel } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/utils';

import { DashboardScene } from '../../dashboard-scene/scene/DashboardScene';
import { MetricScene } from '../MetricScene';
import { reportExploreMetrics } from '../interactions';

import { DataTrailEmbedded, DataTrailEmbeddedState } from './DataTrailEmbedded';
import { SceneDrawerAsScene } from './SceneDrawer';
import { getQueryMetrics, QueryMetric } from './getQueryMetrics';
import { createAdHocFilters, getQueryMetricLabel, getTimeRangeStateFromDashboard } from './utils';

export async function addDataTrailPanelAction(dashboard: DashboardScene, panel: VizPanel, items: PanelMenuItem[]) {
  if (panel.state.pluginId !== 'timeseries') {
    return;
  }

  const queryRunner = getQueryRunnerFor(panel);
  if (queryRunner == null) {
    return;
  }

  const { queries, datasource, data } = queryRunner.state;

  if (datasource == null) {
    return;
  }

  if (datasource.type !== 'prometheus') {
    return;
  }

  let dataSourceApi: DataSourceApi | undefined;

  try {
    dataSourceApi = await getDataSourceSrv().get(datasource);
  } catch (e) {
    return;
  }

  if (dataSourceApi.interpolateVariablesInQueries == null) {
    return;
  }

  const interpolated = dataSourceApi
    .interpolateVariablesInQueries(queries, { __sceneObject: { value: panel } }, data?.request?.filters)
    .filter(isPromQuery);

  const queryMetrics = getQueryMetrics(interpolated.map((q) => q.expr));

  const subMenu: PanelMenuItem[] = queryMetrics.map((item) => {
    return {
      text: getQueryMetricLabel(item),
      onClick: createClickHandler(item, dashboard, dataSourceApi),
    };
  });

  if (subMenu.length > 0) {
    items.push({
      text: 'Metrics drilldown',
      iconClassName: 'code-branch',
      subMenu: getUnique(subMenu),
    });
  }
}

function getUnique<T extends { text: string }>(items: T[]) {
  const uniqueMenuTexts = new Set<string>();

  function isUnique({ text }: { text: string }) {
    const before = uniqueMenuTexts.size;
    uniqueMenuTexts.add(text);
    const after = uniqueMenuTexts.size;
    return after > before;
  }

  return items.filter(isUnique);
}

function getEmbeddedTrailsState(
  { metric, labelFilters, query }: QueryMetric,
  timeRangeState: SceneTimeRangeState,
  dataSourceUid: string | undefined
) {
  const state: DataTrailEmbeddedState = {
    metric,
    filters: createAdHocFilters(labelFilters),
    dataSourceUid,
    timeRangeState,
  };

  return state;
}

function createCommonEmbeddedTrailStateProps(item: QueryMetric, dashboard: DashboardScene, ds: DataSourceRef) {
  const timeRangeState = getTimeRangeStateFromDashboard(dashboard);
  const trailState = getEmbeddedTrailsState(item, timeRangeState, ds.uid);
  const embeddedTrail: DataTrailEmbedded = new DataTrailEmbedded(trailState);

  embeddedTrail.trail.addActivationHandler(() => {
    if (embeddedTrail.trail.state.topScene instanceof MetricScene) {
      embeddedTrail.trail.state.topScene.setActionView('breakdown');
    }
  });

  const commonProps = {
    scene: embeddedTrail,
    title: 'Metrics drilldown',
  };

  return commonProps;
}

function createClickHandler(item: QueryMetric, dashboard: DashboardScene, ds: DataSourceRef) {
  return () => {
    const commonProps = createCommonEmbeddedTrailStateProps(item, dashboard, ds);
    const drawerScene = new SceneDrawerAsScene({
      ...commonProps,
      onDismiss: () => dashboard.closeModal(),
    });
    reportExploreMetrics('exploration_started', { cause: 'dashboard_panel' });
    dashboard.showModal(drawerScene);
  };
}

export function isPromQuery(model: DataQuery): model is PromQuery {
  return 'expr' in model;
}
